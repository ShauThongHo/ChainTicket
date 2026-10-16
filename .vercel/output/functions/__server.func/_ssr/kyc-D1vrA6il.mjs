import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { C as useNavigate, T as require_jsx_runtime, w as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { G as saveKyc, a as useSession, r as Route$9 } from "./router-BzXJkpoJ.mjs";
import { n as Button, r as Card, t as AppShell } from "./card-DZLSP1m-.mjs";
import { t as Badge } from "./badge-BKi_jLwJ.mjs";
import { t as Input } from "./input-DurNKGpM.mjs";
import { t as Label } from "./label-DCFjKh4h.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/kyc-D1vrA6il.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function defaultExpiry() {
	const d = /* @__PURE__ */ new Date();
	d.setUTCDate(d.getUTCDate() + 400);
	return d.toISOString().slice(0, 10);
}
function todayUtc() {
	return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function KycPage() {
	const { me, refresh } = useSession();
	const { next } = Route$9.useSearch();
	const navigate = useNavigate();
	const router = useRouter();
	const [fullName, setFullName] = (0, import_react.useState)("Alex Tan");
	const [idNumber, setIdNumber] = (0, import_react.useState)("DEMO-900128");
	const [nationality, setNationality] = (0, import_react.useState)("Classroom");
	const [documentExpiresAt, setDocumentExpiresAt] = (0, import_react.useState)(defaultExpiry);
	const [photoName, setPhotoName] = (0, import_react.useState)("");
	const [photoBase64, setPhotoBase64] = (0, import_react.useState)("");
	const [contentType, setContentType] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const kyc = me?.kyc;
	async function onPhoto(file) {
		setPhotoName("");
		setPhotoBase64("");
		setContentType("");
		if (!file) return;
		const name = file.name.toLowerCase();
		const type = file.type === "image/png" || name.endsWith(".png") ? "image/png" : file.type === "image/jpeg" || file.type === "image/jpg" || name.endsWith(".jpg") || name.endsWith(".jpeg") ? "image/jpeg" : "";
		if (!type) {
			toast.error("Photo must be a JPEG or PNG.");
			return;
		}
		if (file.size > 4e6) {
			toast.error("Photo must be under 4MB.");
			return;
		}
		const dataUrl = await new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result || ""));
			reader.onerror = () => reject(/* @__PURE__ */ new Error("Could not read the photo."));
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
	async function submit(e) {
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
			const res = await saveKyc({ data: {
				fullName,
				idNumber,
				nationality,
				documentExpiresAt,
				photoBase64,
				contentType
			} });
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
	const tone = kyc?.status === "approved" ? "sage" : kyc?.status === "rejected" || kyc?.status === "expired" ? "danger" : "mist";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "font-display text-4xl",
			children: "Verify your ticket access"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 max-w-xl text-sm text-muted",
			children: "Demo only: use sample details, never a real ID. Your document is stored privately; admins see only what they need to review it."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "mt-6 max-w-md p-5",
			children: [kyc ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-4 grid gap-2 text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone,
								children: kyc.status
							}),
							kyc.idLast4 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-mono text-xs text-muted",
								children: ["ID ····", kyc.idLast4]
							}) : null,
							kyc.documentExpiresAt ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-mono text-xs text-muted",
								children: ["expires ", kyc.documentExpiresAt]
							}) : null
						]
					}),
					kyc.status === "pending" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "Waiting for an admin to approve."
					}) : null,
					kyc.status === "approved" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-muted",
						children: "Approved. You can buy while the document date is still valid."
					}) : null,
					kyc.status === "rejected" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-danger",
						children: kyc.rejectReason || "Rejected. Submit again with a new photo."
					}) : null,
					kyc.status === "expired" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs text-danger",
						children: "This ID document has expired. Submit KYC again before buying."
					}) : null
				]
			}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "grid gap-4",
				onSubmit: (e) => void submit(e),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "name",
							children: "Full name"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "name",
							value: fullName,
							onChange: (e) => setFullName(e.target.value),
							required: true
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "id",
							children: "ID number"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "id",
							value: idNumber,
							onChange: (e) => setIdNumber(e.target.value),
							required: true
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "nation",
							children: "Nationality"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "nation",
							value: nationality,
							onChange: (e) => setNationality(e.target.value),
							required: true
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
							htmlFor: "exp",
							children: "Document expiry"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							id: "exp",
							type: "date",
							min: todayUtc(),
							value: documentExpiresAt,
							onChange: (e) => setDocumentExpiresAt(e.target.value),
							required: true
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-1.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
								htmlFor: "photo",
								children: "Document photo"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								id: "photo",
								className: "h-auto py-2",
								type: "file",
								accept: "image/jpeg,image/png,.jpg,.jpeg,.png",
								required: !photoBase64,
								onChange: (e) => void onPhoto(e.target.files?.[0] ?? null)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted",
								children: photoName ? `${photoName} · JPEG or PNG, under 4MB. Not a real ID.` : "JPEG or PNG, under 4MB. Required."
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						type: "submit",
						disabled: busy || !me || !photoBase64,
						children: busy ? "Saving…" : kyc ? "Submit again" : "Submit KYC"
					})
				]
			})]
		})
	] });
}
//#endregion
export { KycPage as component };
