import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  ShieldCheck,
  Upload,
  UserCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { useSession } from "@/components/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveKyc } from "@/lib/api";

const searchSchema = z.object({
  next: z.string().optional(),
});

export const Route = createFileRoute("/kyc")({
  validateSearch: (s) => searchSchema.parse(s),
  component: KycPage,
});

function defaultExpiry() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 400);
  return d.toISOString().slice(0, 10);
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

async function compressPhoto(file: File): Promise<string> {
  const image = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not process the photo.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (let attempt = 0; attempt < 5; attempt++) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82 - attempt * 0.08),
    );
    if (!blob) throw new Error("Could not process the photo.");
    if (blob.size <= 600_000) {
      image.close();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Could not read the photo."));
        reader.readAsDataURL(blob);
      });
    }
    canvas.width = Math.round(canvas.width * 0.8);
    canvas.height = Math.round(canvas.height * 0.8);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  }
  image.close();
  throw new Error("Photo could not be reduced enough. Please choose a smaller image.");
}

function KycPage() {
  const { me, refresh } = useSession();
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [nationality, setNationality] = useState("");
  const [documentExpiresAt, setDocumentExpiresAt] = useState(defaultExpiry);
  const [photoName, setPhotoName] = useState("");
  const [photoBase64, setPhotoBase64] = useState("");
  const [contentType, setContentType] = useState<"image/jpeg" | "image/png" | "">("");
  const [busy, setBusy] = useState(false);
  const kyc = me?.kyc;

  async function onPhoto(file: File | null) {
    setPhotoName("");
    setPhotoBase64("");
    setContentType("");
    if (!file) return;
    const name = file.name.toLowerCase();
    const type =
      file.type === "image/png" || name.endsWith(".png")
        ? "image/png"
        : file.type === "image/jpeg" ||
            file.type === "image/jpg" ||
            name.endsWith(".jpg") ||
            name.endsWith(".jpeg")
          ? "image/jpeg"
          : "";
    if (!type) {
      toast.error("Photo must be a JPEG or PNG.");
      return;
    }
    if (file.size > 4_000_000) {
      toast.error("Photo must be under 4MB.");
      return;
    }
    let raw = "";
    try {
      raw = await compressPhoto(file);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not process the photo.");
      return;
    }
    if (!raw) {
      toast.error("Could not read the photo.");
      return;
    }
    setPhotoName(file.name);
    setPhotoBase64(raw);
    setContentType("image/jpeg");
  }

  function fillDemoPhoto() {
    // Generate a lightweight placeholder canvas JPEG for quick testing
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 260;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, 400, 260);
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 20px sans-serif";
      ctx.fillText("ChainTicket Demo ID Pass", 24, 60);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "14px monospace";
      ctx.fillText(`Holder: ${fullName}`, 24, 110);
      ctx.fillText(`ID: ${idNumber}`, 24, 140);
      ctx.fillText(`Expires: ${documentExpiresAt}`, 24, 170);
      ctx.fillText("STATUS: VERIFIED SAMPLE", 24, 210);
      const b64 = canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
      setPhotoName("demo-sample-credential.jpg");
      setPhotoBase64(b64);
      setContentType("image/jpeg");
      toast.success("Loaded demo credential pass for instant verification");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!contentType || !photoBase64) {
      toast.error("A JPEG or PNG of the document is required. Use 'Use Demo Pass' if testing.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(documentExpiresAt) || documentExpiresAt < todayUtc()) {
      toast.error("Document expiry must be today or later.");
      return;
    }
    setBusy(true);
    try {
      const res = await saveKyc({
        data: { fullName, idNumber, nationality, documentExpiresAt, photoBase64, contentType },
      });
      await refresh();
      if (res.status === "approved") {
        toast.success("KYC approved! You can now purchase passes.");
      } else {
        toast.success("Submitted for administrator review.");
      }
      if (res.status === "approved") {
        if (next) router.history.push(next);
        else await navigate({ to: "/marketplace" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "KYC failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl py-4">
        {/* HEADER */}
        <div className="mb-6 border-b border-border pb-5">
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-fg">
            Identity Verification
          </h1>
          <p className="mt-1.5 text-xs text-muted">
            1-ticket-per-wallet verification to prevent scalper bots from hoarding inventory.
          </p>
        </div>

        {/* STATUS BANNER */}
        {kyc ? (
          <div
            className={`mb-6 rounded-2xl border p-5 transition-all ${
              kyc.status === "approved"
                ? "border-success/40 bg-success/10 text-fg"
                : kyc.status === "rejected" || kyc.status === "expired"
                  ? "border-danger/40 bg-danger/10 text-fg"
                  : "border-primary/40 bg-primary/10 text-fg"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {kyc.status === "approved" ? (
                  <CheckCircle2 className="size-5 text-success" />
                ) : kyc.status === "pending" ? (
                  <Clock className="size-5 text-primary" />
                ) : (
                  <XCircle className="size-5 text-danger" />
                )}
                <span className="font-display text-base font-bold capitalize">
                  {kyc.status}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                {kyc.idLast4 ? <span>ID: ····{kyc.idLast4}</span> : null}
                {kyc.documentExpiresAt ? <span>Exp: {kyc.documentExpiresAt}</span> : null}
              </div>
            </div>

            <div className="mt-2 text-xs text-muted">
              {kyc.status === "approved"
                ? "Verified on-chain. You can purchase live show passes."
                : kyc.status === "pending"
                  ? "Submission in queue for review."
                  : kyc.status === "expired"
                    ? "Document expired. Please update."
                    : kyc.rejectReason || "Submission rejected. Please re-submit."}
            </div>
          </div>
        ) : null}

        {/* VERIFICATION FORM */}
        <Card className="rounded-2xl border border-border bg-bg-elevated p-6 sm:p-8 shadow-xs">
          <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-6">
            <div className="flex items-center gap-2 font-bold text-fg text-sm">
              <UserCheck className="size-4 text-primary" />
              <span>Credentials</span>
            </div>
            <button
              type="button"
              onClick={fillDemoPhoto}
              className="inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-primary hover:bg-primary/20"
            >
              <FileText className="size-3" />
              <span>Use Demo Pass Sample</span>
            </button>
          </div>

          <form className="grid gap-5" onSubmit={(e) => void submit(e)}>
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-xs font-semibold">Full Legal Name</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Alex Tan"
                required
                className="bg-bg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="id" className="text-xs font-semibold">Government / Passport ID</Label>
                <Input
                  id="id"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="e.g. S9001284A"
                  required
                  className="bg-bg font-mono"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="nation" className="text-xs font-semibold">Nationality</Label>
                <Input
                  id="nation"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  placeholder="e.g. Singapore"
                  required
                  className="bg-bg"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="exp" className="text-xs font-semibold">Document Expiry Date</Label>
              <Input
                id="exp"
                type="date"
                min={todayUtc()}
                value={documentExpiresAt}
                onChange={(e) => setDocumentExpiresAt(e.target.value)}
                required
                className="bg-bg font-mono"
              />
            </div>

            {/* DOCUMENT UPLOAD DROPZONE */}
            <div className="grid gap-2">
              <Label htmlFor="photo" className="text-xs font-semibold">Document Photo or Pass Scan</Label>
              <div className="rounded-xl border-2 border-dashed border-border bg-bg/50 p-4 text-center">
                <Upload className="size-6 text-muted mx-auto mb-2" />
                <Input
                  id="photo"
                  type="file"
                  accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                  required={!photoBase64}
                  onChange={(e) => void onPhoto(e.target.files?.[0] ?? null)}
                  className="mx-auto max-w-xs text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-primary-fg"
                />
                <p className="mt-2 font-mono text-[11px] text-muted">
                  {photoName ? (
                    <span className="text-success font-semibold">Attached: {photoName}</span>
                  ) : (
                    "JPEG or PNG under 4MB"
                  )}
                </p>
              </div>
            </div>

            {/* SECURITY ASSURANCE */}
            <div className="rounded-xl bg-mist/30 px-3.5 py-2.5 text-xs text-muted flex items-center gap-2">
              <Lock className="size-3.5 text-primary shrink-0" />
              <span>Encrypted with AES-256-GCM. Hash stored for anti-sybil proof.</span>
            </div>

            <Button
              type="submit"
              disabled={busy || !me || !photoBase64}
              className="w-full font-bold shadow-xs py-3"
            >
              {busy
                ? "Encrypting…"
                : kyc?.status === "approved"
                  ? "Update Verification"
                  : kyc?.status === "rejected"
                    ? "Re-submit Verification"
                    : "Submit Verification"}
            </Button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
