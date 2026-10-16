import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
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

function KycPage() {
  const { me, refresh } = useSession();
  const { next } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const [fullName, setFullName] = useState("Alex Tan");
  const [idNumber, setIdNumber] = useState("DEMO-900128");
  const [nationality, setNationality] = useState("Classroom");
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
        : file.type === "image/jpeg" || file.type === "image/jpg" || name.endsWith(".jpg") || name.endsWith(".jpeg")
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
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read the photo."));
      reader.readAsDataURL(file);
    });
    const comma = dataUrl.indexOf(",");
    const raw = comma >= 0 ? dataUrl.slice(comma + 1) : "";
    if (!raw) {
      toast.error("Could not read the photo.");
      return;
    }
    setPhotoName(file.name);
    setPhotoBase64(raw);
    setContentType(type);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!contentType || !photoBase64) {
      toast.error("A JPEG or PNG of the document is required.");
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
      if (res.status === "approved") toast.success("KYC approved. You can buy.");
      else toast.success("Submitted. An admin must approve this wallet before Buy Now.");
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

  const tone =
    kyc?.status === "approved" ? "sage" : kyc?.status === "rejected" || kyc?.status === "expired" ? "danger" : "mist";

  return (
    <AppShell>
      <h1 className="font-display text-4xl">Verify your ticket access</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Demo only: use sample details, never a real ID. Your document is stored privately; admins see only what they need to review it.
      </p>
      <Card className="mt-6 max-w-md p-5">
        {kyc ? (
          <div className="mb-4 grid gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={tone}>{kyc.status}</Badge>
              {kyc.idLast4 ? <span className="font-mono text-xs text-muted">ID ····{kyc.idLast4}</span> : null}
              {kyc.documentExpiresAt ? (
                <span className="font-mono text-xs text-muted">expires {kyc.documentExpiresAt}</span>
              ) : null}
            </div>
            {kyc.status === "pending" ? (
              <p className="text-xs text-muted">Waiting for an admin to approve.</p>
            ) : null}
            {kyc.status === "approved" ? (
              <p className="text-xs text-muted">Approved. You can buy while the document date is still valid.</p>
            ) : null}
            {kyc.status === "rejected" ? (
              <p className="text-xs text-danger">{kyc.rejectReason || "Rejected. Submit again with a new photo."}</p>
            ) : null}
            {kyc.status === "expired" ? (
              <p className="text-xs text-danger">This ID document has expired. Submit KYC again before buying.</p>
            ) : null}
          </div>
        ) : null}
        <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
          <div className="grid gap-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="id">ID number</Label>
            <Input id="id" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nation">Nationality</Label>
            <Input id="nation" value={nationality} onChange={(e) => setNationality(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="exp">Document expiry</Label>
            <Input
              id="exp"
              type="date"
              min={todayUtc()}
              value={documentExpiresAt}
              onChange={(e) => setDocumentExpiresAt(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="photo">Document photo</Label>
            <Input
              id="photo"
              className="h-auto py-2"
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              required={!photoBase64}
              onChange={(e) => void onPhoto(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted">
              {photoName ? `${photoName} · JPEG or PNG, under 4MB. Not a real ID.` : "JPEG or PNG, under 4MB. Required."}
            </p>
          </div>
          <Button type="submit" disabled={busy || !me || !photoBase64}>
            {busy ? "Saving…" : kyc ? "Submit again" : "Submit KYC"}
          </Button>
        </form>
      </Card>
    </AppShell>
  );
}
