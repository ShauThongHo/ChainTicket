import { createFileRoute, Link } from "@tanstack/react-router";
import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  QrCode,
  Scan,
  ShieldCheck,
  Ticket,
  XCircle,
} from "lucide-react";
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
  const [lastScan, setLastScan] = useState<{
    status: "ok" | "deny" | "idle";
    msg: string;
    tokenId?: string;
    event?: string;
    time?: string;
  }>({ status: "idle", msg: "Awaiting visitor gate pass QR…" });
  const [busy, setBusy] = useState(false);
  const chain = useChainRun();
  const lock = useRef(false);

  async function submit(payload: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await chain.run({
        title: "Verify & check in ticket",
        labels: ["Decrypt & verify HMAC", "Broadcast on-chain checkIn", "Save admission record"],
        task: async (advance) => {
          advance(1);
          const res = await scanCheckIn({ data: { payload } });
          advance(2);
          setLastScan({
            status: "ok",
            tokenId: String(res.tokenId),
            event: res.eventName,
            msg: `ADMITTED · Token #${res.tokenId} · ${res.eventName}`,
            time: new Date().toLocaleTimeString(),
          });
          toast.success(`Entry granted: Token #${res.tokenId}`);
          return `Entry confirmed for ticket #${res.tokenId}.`;
        },
        retry: () => void submit(payload),
      });
    } catch (e) {
      const msg = friendlyChainError(e);
      setLastScan({
        status: "deny",
        msg: `DENIED · ${msg}`,
        time: new Date().toLocaleTimeString(),
      });
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
        /* camera may be blocked or unavailable in the environment */
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
        <div className="rounded-2xl border border-dashed border-border bg-bg-elevated p-12 text-center my-8">
          <ShieldCheck className="size-10 text-muted mx-auto mb-3" />
          <h2 className="font-display text-2xl font-bold">Organizer Access Required</h2>
          <p className="mt-1 text-sm text-muted max-w-sm mx-auto">
            Live gate scanner modules are restricted to approved event organizers and operators.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
        <Link
          to="/organizer"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-muted hover:text-fg"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Organizer Shows</span>
        </Link>
        <div className="flex items-center gap-2 font-mono text-xs text-muted">
          <span className="size-2 rounded-full bg-success animate-pulse" />
          <span>Gate Verifier Active</span>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-fg">
          Gate Turnstile Scanner
        </h1>
        <p className="text-sm text-muted mt-1">
          Camera auto-decodes rotating HMAC-SHA256 entry barcodes and verifies on-chain ownership in real-time.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        {/* VIEWFINDER CAMERA CARD */}
        <div className="lg:col-span-7">
          <Card className="relative overflow-hidden rounded-2xl border border-border bg-ink p-2 shadow-md">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-950 flex items-center justify-center">
              <video
                ref={videoRef}
                className="size-full object-cover"
                muted
                playsInline
              />
              <canvas ref={canvasRef} className="hidden" />

              {/* OVERLAY RETICLE SCANFRAME */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative size-60 rounded-2xl border-2 border-primary/60 shadow-[0_0_20px_rgba(49,91,115,0.3)]">
                  {/* Four Corner Reticle accents */}
                  <div className="absolute -top-1.5 -left-1.5 size-5 border-t-4 border-l-4 border-primary" />
                  <div className="absolute -top-1.5 -right-1.5 size-5 border-t-4 border-r-4 border-primary" />
                  <div className="absolute -bottom-1.5 -left-1.5 size-5 border-b-4 border-l-4 border-primary" />
                  <div className="absolute -bottom-1.5 -right-1.5 size-5 border-b-4 border-r-4 border-primary" />

                  {/* Animated Laser Scanline */}
                  <div className="scan-laser-line" />
                </div>
              </div>

              {/* LIVE PROMPT */}
              <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink/80 px-3.5 py-1 text-center font-mono text-[11px] text-paper/90 backdrop-blur-md">
                Align visitor dynamic QR within frame
              </div>
            </div>
          </Card>
        </div>

        {/* VERIFICATION VERDICT & MANUAL INPUT */}
        <div className="lg:col-span-5 space-y-4">
          {/* VERDICT CARD */}
          <Card
            className={`p-6 rounded-2xl border transition-all ${
              lastScan.status === "ok"
                ? "border-success/60 bg-success/10 text-fg"
                : lastScan.status === "deny"
                  ? "border-danger/60 bg-danger/10 text-fg"
                  : "border-border bg-bg-elevated"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-mono text-muted mb-2">
              <span className="uppercase tracking-wider">Verification Verdict</span>
              {lastScan.time ? <span>{lastScan.time}</span> : null}
            </div>

            <div className="flex items-start gap-3 my-2">
              {lastScan.status === "ok" ? (
                <CheckCircle2 className="size-8 text-success shrink-0" />
              ) : lastScan.status === "deny" ? (
                <XCircle className="size-8 text-danger shrink-0" />
              ) : (
                <Camera className="size-8 text-muted shrink-0" />
              )}
              <div>
                <p className="font-display text-xl font-bold">
                  {lastScan.status === "ok"
                    ? "ADMITTED · ACCESS GRANTED"
                    : lastScan.status === "deny"
                      ? "ENTRY DENIED"
                      : "SCANNER STANDBY"}
                </p>
                <p className="font-mono text-xs mt-1 leading-relaxed">
                  {lastScan.msg}
                </p>
              </div>
            </div>
          </Card>

          <ChainDialog {...chain} onClose={chain.close} />

          {/* MANUAL PAYLOAD BACKUP INPUT */}
          <Card className="p-5 rounded-2xl border border-border bg-bg-elevated">
            <div className="flex items-center gap-2 mb-2 font-semibold text-xs text-fg">
              <QrCode className="size-4 text-primary" />
              <span>Manual Payload Fallback</span>
            </div>
            <p className="text-xs text-muted mb-3 leading-relaxed">
              If camera access is blocked in this browser, manually paste the visitor's dynamic payload below:
            </p>

            <form
              className="grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (manual.trim()) void submit(manual.trim());
              }}
            >
              <Input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="CT1.ticketId.bucket.hmacSignature"
                className="font-mono text-xs bg-bg"
              />
              <Button type="submit" disabled={busy || !manual.trim()} className="font-semibold shadow-xs">
                {busy ? "Verifying On-Chain…" : "Check In Pass"}
              </Button>
            </form>
          </Card>

          {/* 1.2S DEBOUNCE SAFEGUARD NOTE */}
          <div className="rounded-xl bg-mist/40 p-3.5 text-xs text-muted flex items-start gap-2">
            <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>1.2s Anti-Double-Read Guard</strong>: Automated hardware debounce prevents duplicate ticket check-in transactions while maintaining rapid patron throughput.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
