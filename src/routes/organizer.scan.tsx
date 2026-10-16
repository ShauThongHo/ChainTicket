import { createFileRoute } from "@tanstack/react-router";
import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/components/session";
import { ChainDialog, useChainRun } from "@/components/tx-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { scanCheckIn } from "@/lib/api";
import { friendlyChainError } from "@/lib/chain-errors";

export const Route = createFileRoute("/organizer/scan")({ component: ScanPage });

function ScanPage() {
  const { me } = useSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [manual, setManual] = useState("");
  const [last, setLast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const chain = useChainRun();
  const lock = useRef(false);

  async function submit(payload: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await chain.run({ title: "Check in ticket", labels: ["Check ticket", "Record entry on-chain", "Save check-in"], task: async (advance) => {
        advance(1);
        const res = await scanCheckIn({ data: { payload } });
        advance(2);
        setLast(`IN · ${res.tokenId} · ${res.eventName}`);
        return `Entry confirmed for ticket ${res.tokenId}.`;
      }, retry: () => void submit(payload) });
    } catch (e) {
      const msg = friendlyChainError(e);
      setLast(`DENY · ${msg}`);
      toast.error(msg);
    } finally {
      setBusy(false);
      setTimeout(() => {
        lock.current = false;
      }, 1200);
    }
  }

  useEffect(() => {
    if (!me?.isOrganizer && !me?.isAdmin) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let dead = false;
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const tick = () => {
          if (dead) return;
          const canvas = canvasRef.current;
          if (video && canvas && video.readyState >= 2) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(img.data, img.width, img.height);
              if (code?.data.startsWith("CT1.")) void submit(code.data);
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        /* camera may be blocked in the preview iframe */
      }
    }
    void start();
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [me?.isOrganizer, me?.isAdmin]);

  if (!me?.isOrganizer && !me?.isAdmin) {
    return (
      <AppShell>
        <p className="text-sm text-muted">Gate scanners are limited to approved organizers.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h1 className="font-display text-4xl italic">Gate scanner</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Server auto-signs the Used state. Camera may be blocked in some embeds — paste the QR
        payload as a fallback.
      </p>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <video ref={videoRef} className="aspect-[3/4] w-full bg-ink object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
        </Card>
        <div>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted">Last result</p>
            <p className="mt-2 font-mono text-sm">{last ?? "Waiting for a live QR…"}</p>
            <ChainDialog {...chain} onClose={chain.close} />
          </Card>
          <form
            className="mt-4 grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (manual.trim()) void submit(manual.trim());
            }}
          >
            <Input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="CT1.ticket.bucket.hmac"
            />
            <Button type="submit" disabled={busy}>
              Check in
            </Button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
