import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/components/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchOrganizers, patchOrganizer, saveOrganizer } from "@/lib/api";
import type { OrganizerRow } from "@/lib/types";
import { shortAddr } from "@/lib/utils";

export const Route = createFileRoute("/admin/organizers")({ component: OrganizersPage });

function OrganizersPage() {
  const { me, refresh } = useSession();
  const [rows, setRows] = useState<OrganizerRow[]>([]);
  const [wallet, setWallet] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      setRows(await fetchOrganizers());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load organizers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (me?.isAdmin) void reload();
  }, [me?.isAdmin]);

  if (!me?.isAdmin) {
    return (
      <AppShell>
        <p className="text-sm text-muted">Admin only.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/admin">Back to Admin</Link>
        </Button>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Access</p>
          <h1 className="font-display text-4xl italic">Verified organizers</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Paste a venue wallet and approve it. Connecting that wallet later opens the organizer
            dashboard automatically. The platform admin is not an organizer.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/admin">Dashboard</Link>
        </Button>
      </div>
      <Card className="mt-6 max-w-xl p-5">
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Organizer wallet</Label>
            <Input
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="0x…"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Label / name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Venue company" />
          </div>
          <Button
            onClick={async () => {
              try {
                await saveOrganizer({ data: { wallet, name } });
                toast.success("Organizer approved");
                setName("");
                setWallet("");
                await reload();
                await refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            Verify & add
          </Button>
        </div>
      </Card>
      <div className="mt-6 divide-y divide-border rounded-xl border border-border">
        {loading && rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">Loading organizers…</p>
        ) : null}
        {!loading && rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No organizers yet. Add a wallet above.</p>
        ) : null}
        {rows.map((row) => (
          <div key={row.wallet} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="font-mono text-xs text-muted">{shortAddr(row.wallet)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={row.status === "approved" ? "sage" : "danger"}>{row.status}</Badge>
              <span className="text-xs text-muted">{row.eventCount} events</span>
              {row.status === "approved" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await patchOrganizer({ data: { wallet: row.wallet, status: "revoked" } });
                    await reload();
                  }}
                >
                  Revoke
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={async () => {
                    await patchOrganizer({ data: { wallet: row.wallet, status: "approved" } });
                    await reload();
                  }}
                >
                  Approve
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
