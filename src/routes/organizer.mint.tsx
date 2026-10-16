import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/components/session";
import { ChainDialog, useChainRun } from "@/components/tx-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createEvent, fetchMintProgress, uploadPoster } from "@/lib/api";
import { friendlyChainError } from "@/lib/chain-errors";
import { shortAddr } from "@/lib/utils";
import { explorerAddress, gatewayUrl } from "@/lib/explorer";
import { Hint } from "@/components/hint";

export const Route = createFileRoute("/organizer/mint")({ component: MintPage });

type TierDraft = { name: string; face: string; supply: string };

function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function MintPage() {
  const { me, config } = useSession();
  const navigate = useNavigate();
  const startDefault = useMemo(() => localInput(new Date(Date.now() + 90 * 60 * 1000)), []);
  const endDefault = useMemo(() => localInput(new Date(Date.now() + 6 * 60 * 60 * 1000)), []);
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [category, setCategory] = useState("Concert");
  const [posterUrl, setPosterUrl] = useState("");
  const [posterCid, setPosterCid] = useState("");
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState(startDefault);
  const [endsAt, setEndsAt] = useState(endDefault);
  const [tiers, setTiers] = useState<TierDraft[]>([
    { name: "General Admission", face: "40.00", supply: "12" },
  ]);
  const [busy, setBusy] = useState(false);
  const [mintReceipt, setMintReceipt] = useState<{ collection: string; metadata: { tierName: string; tokenUri: string; tokenId: number }[] } | null>(null);
  const chain = useChainRun();
  const symbol = config?.nativeSymbol ?? "xDAI";

  async function onPoster(file: File) {
    setUploading(true);
    try {
      const base64 = toBase64(await file.arrayBuffer());
      const res = await uploadPoster({
        data: { filename: file.name, contentType: file.type || "image/jpeg", base64 },
      });
      setPosterUrl(res.url);
      setPosterCid(res.cid);
      toast.success("Poster pinned to IPFS");
    } catch (err) {
      toast.error(err instanceof Error ? friendlyChainError(err) : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const labels = [
      "Pin ticket artwork and details",
      "Create the event vault",
      "Create the ticket marketplace",
      "Link the vault and marketplace",
      "Create the ticket collection",
      "Link the collection",
      ...(config?.devMode && config.demoBank ? ["Register test coins"] : []),
      ...tiers.flatMap((tier) => [`Write ${tier.name || "ticket"} metadata`, `Mint ${tier.name || "ticket"} supply`]),
      "Save event and ticket inventory",
    ];
    try {
      await chain.run({
        title: "Creating your event",
        labels,
        doneLabel: "Back to workspace",
        onDone: () => navigate({ to: "/organizer" }),
        task: async (advance) => {
          setMintReceipt(null);
          advance(1);
          const jobId = crypto.randomUUID();
          const creating = createEvent({
        data: {
          jobId,
          name,
          venue,
          category,
          posterUrl,
          description,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          tiers: tiers.map((t) => ({
            name: t.name,
            faceCents: Math.round(Number(t.face) * 100),
            supply: Number(t.supply),
          })),
        },
          });
          let createFinished = false;
          let mintResult: Awaited<ReturnType<typeof createEvent>> | null = null;
          let mintError: unknown;
          void creating.then((result) => { mintResult = result; createFinished = true; }, (error: unknown) => { mintError = error; createFinished = true; });
          while (!createFinished) {
            const progress = await fetchMintProgress({ data: { jobId } });
            advance(Math.min(progress.currentStep, labels.length - 1));
            if (progress.status === "failed") break;
            await new Promise((resolve) => setTimeout(resolve, 700));
          }
          if (mintError) throw mintError;
          const res = mintResult ?? await creating;
          advance(labels.length - 1);
          setMintReceipt({ collection: res.collection, metadata: res.metadata });
          return `Your event is ready. Ticket collection ${shortAddr(res.collection)}.`;
        },
      });
    } catch (err) {
      toast.error(friendlyChainError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!me?.isOrganizer) {
    return (
      <AppShell>
        <p className="text-sm text-muted">Approved organizers only.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="font-display text-4xl">Create an event</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Add the show and the tickets you want to sell.
      </p>
      <ChainDialog {...chain} onClose={chain.close} successDetails={mintReceipt ? (
        <div className="mt-3 grid gap-1 text-xs text-muted">
          <a className="text-primary underline" href={explorerAddress(mintReceipt.collection, config?.explorerUrl ?? "")} target="_blank" rel="noreferrer">
            Collection {shortAddr(mintReceipt.collection)}
          </a>
          {mintReceipt.metadata[0] ? <a className="text-primary underline" href={gatewayUrl(mintReceipt.metadata[0].tokenUri)} target="_blank" rel="noreferrer">
            Open ticket details · token #{mintReceipt.metadata[0].tokenId}
          </a> : null}
          <span>Explorer images can take time to appear. Open the details to check the JSON and image.</span>
        </div>
      ) : null} />
      <Card className="mt-6 p-5">
        <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
          <div className="grid gap-1.5">
            <Label>Show name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Venue</Label>
              <Input value={venue} onChange={(e) => setVenue(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Poster <Hint>Use a public image link or upload artwork. It will appear on the ticket and event page.</Hint></Label>
            <Input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onPoster(file);
              }}
            />
            {uploading ? <p className="text-xs text-muted">Uploading to IPFS…</p> : null}
            {posterUrl ? (
              <p className="break-all font-mono text-xs text-muted">
                {posterCid ? `cid ${posterCid} · ` : ""}
                {posterUrl}
              </p>
            ) : (
              <p className="text-xs text-muted">
                {config?.pinataReady ? "Choose an image or paste a poster link." : "Paste a poster link, or ask an admin to enable uploads."}
              </p>
            )}
            <Input
              value={posterUrl}
              onChange={(e) => setPosterUrl(e.target.value)}
              placeholder="https://… (optional if you already uploaded)"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Starts</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Ends</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Ticket types</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setTiers((t) => [...t, { name: "New tier", face: "80.00", supply: "8" }])
                }
              >
                Add tier
              </Button>
            </div>
            <div className="mt-3 grid gap-3">
              {tiers.map((tier, i) => (
                <div key={i} className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-3">
                  <Input
                    value={tier.name}
                    onChange={(e) =>
                      setTiers((rows) => rows.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))
                    }
                    placeholder="Tier name"
                  />
                  <Input
                    value={tier.face}
                    onChange={(e) =>
                      setTiers((rows) => rows.map((r, idx) => (idx === i ? { ...r, face: e.target.value } : r)))
                    }
                    placeholder={`Face ${symbol}`}
                  />
                  <div className="flex gap-2">
                    <Input
                      value={tier.supply}
                      onChange={(e) =>
                        setTiers((rows) =>
                          rows.map((r, idx) => (idx === i ? { ...r, supply: e.target.value } : r)),
                        )
                      }
                      placeholder="Supply"
                    />
                    {tiers.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setTiers((rows) => rows.filter((_, idx) => idx !== i))}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={busy || uploading}>
            {busy ? "Creating event…" : "Create event"}
          </Button>
        </form>
      </Card>
    </AppShell>
  );
}
