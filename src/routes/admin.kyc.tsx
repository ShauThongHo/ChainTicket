import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/components/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchKycDetail, fetchKycPhoto, fetchKycQueue, reviewKyc } from "@/lib/api";
import type { KycDetail, KycListRow, KycStatus } from "@/lib/types";
import { shortAddr } from "@/lib/utils";

export const Route = createFileRoute("/admin/kyc")({ component: AdminKyc });

function AdminKyc() {
  const { me } = useSession();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | KycStatus>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<KycListRow[]>([]);
  const [detail, setDetail] = useState<KycDetail | null>(null);
  const [photo, setPhoto] = useState<{ contentType: string; base64: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const list = await fetchKycQueue({
      data: {
        q,
        status,
        from: from ? new Date(from).toISOString() : "",
        to: to ? new Date(`${to}T23:59:59`).toISOString() : "",
      },
    });
    setRows(list);
  }

  useEffect(() => {
    if (me?.isAdmin) void load().catch((e) => toast.error(e instanceof Error ? e.message : "Load failed"));
    // initial queue only — search is explicit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.isAdmin]);

  if (!me?.isAdmin) {
    return (
      <AppShell>
        <p className="text-sm text-muted">Admin only.</p>
      </AppShell>
    );
  }

  async function openDetail(kycRef: string) {
    setBusy(true);
    setPhoto(null);
    setPhotoBusy(false);
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
      setBusy(false);
    }
  }

  async function decide(approve: boolean) {
    if (!detail) return;
    setBusy(true);
    try {
      await reviewKyc({ data: { kycRef: detail.kycRef, approve, reason } });
      toast.success(approve ? "Approved" : "Rejected");
      setDetail(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Platform</p>
          <h1 className="font-display text-4xl italic">KYC review</h1>
        </div>
        <Button variant="outline" onClick={() => void navigate({ to: "/admin" })}>
          Dashboard
        </Button>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        The list is the public index only: wallet, reference, status. Identity is decrypted when you
        open a row, and that view is written to the audit log. Do not use real documents in this demo.
      </p>

      <Card className="mt-6 p-5">
        <form
          className="grid gap-3 md:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            void load().catch((err) => toast.error(err instanceof Error ? err.message : "Search failed"));
          }}
        >
          <div className="grid gap-1.5 md:col-span-2">
            <Label htmlFor="kyc-q">Wallet or reference</Label>
            <Input id="kyc-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="0x… or kyc ref" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="kyc-status">Status</Label>
            <select
              id="kyc-status"
              className="h-10 rounded-md border border-border bg-paper px-3 text-sm"
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
          <div className="flex items-end">
            <Button type="submit" disabled={busy}>
              Search
            </Button>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="kyc-from">From</Label>
            <Input id="kyc-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="kyc-to">To</Label>
            <Input id="kyc-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </form>
      </Card>

      <div className="mt-4 divide-y divide-border rounded-xl border border-border">
        {rows.length === 0 ? <p className="px-4 py-6 text-sm text-muted">No KYC rows.</p> : null}
        {rows.map((row) => (
          <div key={row.kycRef} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-mono text-sm">{shortAddr(row.wallet)}</p>
              <p className="font-mono text-xs text-muted">
                {row.kycRef.slice(0, 12)}… · {new Date(row.submittedAt).toLocaleString()}
                {row.documentExpiresAt ? ` · exp ${row.documentExpiresAt}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                tone={row.status === "approved" ? "sage" : row.status === "rejected" || row.status === "expired" ? "danger" : "mist"}
              >
                {row.status}
              </Badge>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void openDetail(row.kycRef)}>
                View
              </Button>
            </div>
          </div>
        ))}
      </div>

      {detail ? (
        <Card className="mt-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl italic">Decrypted record</h2>
            <Badge>{detail.status}</Badge>
          </div>
          <p className="mt-1 font-mono text-xs text-muted">
            {detail.wallet} · ref {detail.kycRef}
          </p>
          <dl className="mt-4 grid gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted">Name</dt>
              <dd>{detail.fullName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Nationality</dt>
              <dd>{detail.nationality}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">ID number</dt>
              <dd className="font-mono">{detail.idNumber}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Document expiry</dt>
              <dd className="font-mono">{detail.documentExpiresAt ?? "—"}</dd>
            </div>
          </dl>
          {photo ? (
            <img
              alt="Submitted document"
              className="mt-4 max-h-80 rounded-md border border-border bg-paper object-contain"
              src={`data:${photo.contentType};base64,${photo.base64}`}
            />
          ) : photoBusy ? (
            <p className="mt-4 text-xs text-muted">Loading document photo…</p>
          ) : detail.hasPhoto ? (
            <p className="mt-4 text-xs text-danger">Document photo could not be loaded.</p>
          ) : (
            <p className="mt-4 text-xs text-muted">No document photo stored for this record.</p>
          )}
          <div className="mt-4 grid gap-1.5">
            <Label htmlFor="reject-reason">Reject reason</Label>
            <Input id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => void decide(true)}>
              Approve
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void decide(false)}>
              Reject
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDetail(null);
                setPhoto(null);
              }}
            >
              Close
            </Button>
          </div>
        </Card>
      ) : null}
    </AppShell>
  );
}
