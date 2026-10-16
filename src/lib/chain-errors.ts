/** Map viem / Solidity short reverts into copy a buyer can act on. */

const REASONS: Record<string, string> = {
  st: "Sold out or this listing is no longer active. Refresh and try again.",
  one: "This wallet already holds a ticket for this event.",
  frz: "This event is frozen by the platform admin.",
  ended: "This event has ended.",
  val: "Payment did not match the listing price. Refresh and try again.",
  own: "This wallet does not own that ticket.",
  bound: "Resale price must be within 90–110% of face value.",
  inactive: "That listing is no longer active. Refresh and try again.",
  cancelled: "This event was cancelled.",
  pool: "Demo bank pool is empty. Recast DxDAI in Configuration.",
  bal: "Insufficient DxDAI. Claim from the marketplace, then retry.",
  once: "This wallet already claimed DxDAI from the current bank.",
  op: "Contract operator mismatch. Remint the event after toggling Dev mode.",
  token: "This listing expects DxDAI, not native coin. Refresh and try again.",
  vault: "Vault payment failed. Refresh and try again.",
  roy: "Royalty transfer failed. Refresh and try again.",
  sel: "Seller payout failed. Refresh and try again.",
  no: "Vault cannot withdraw while frozen, cancelled, already withdrawn, or still in a vote.",
  early: "Too early — the event has not ended, or the 3-day holder vote is still open.",
  mkt: "Marketplace is not bound to this vault.",
  pay: "On-chain payment failed. Refresh and try again.",
  gov: "Holder vote has not reached 2/3 yet. Wait for votes or escalate to admin.",
  votes: "Not enough holder votes (need 2/3 of sold tickets).",
  voted: "This ticket already voted on the current payout proposal.",
  uri: "NFT metadata URI is missing. Remint with Pinata configured.",
  escrow: "Tickets can only move through this event’s marketplace — no private transfers.",
  col: "This event has no ERC-721 collection. Ask the organizer to remint.",
  used: "This ticket is already checked in.",
  set: "This address was already bound.",
};


/** Strip private keys, JWTs and database URLs before anything reaches the UI. */
export function redactSecrets(text: string) {
  return text
    .replace(/0x[a-fA-F0-9]{64}/g, "0x••••")
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "••••jwt")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://••••")
    .replace(/((?:key|apikey|api_key|token|jwt)=)[^&\s]+/gi, "$1••••");
}

function asRecord(err: unknown): Record<string, unknown> | null {
  if (err && typeof err === "object") return err as Record<string, unknown>;
  return null;
}

function collectText(err: unknown, depth = 0): string {
  if (err == null || depth > 6) return "";
  if (typeof err === "string") return err;
  const rec = asRecord(err);
  if (!rec) return String(err);
  const parts = [
    rec.shortMessage,
    rec.details,
    rec.reason,
    rec.message,
    rec.data && typeof rec.data === "object" ? (rec.data as { message?: unknown }).message : null,
  ]
    .filter((v) => typeof v === "string" && v)
    .join(" \n ");
  const cause = rec.cause != null ? collectText(rec.cause, depth + 1) : "";
  const walk =
    typeof rec.walk === "function"
      ? (() => {
          try {
            return collectText((rec.walk as (fn: (e: unknown) => unknown) => unknown)((e) => e), depth + 1);
          } catch {
            return "";
          }
        })()
      : "";
  return [parts, cause, walk].filter(Boolean).join(" \n ");
}

export function extractRevertReason(err: unknown): string | null {
  const rec = asRecord(err);
  const nested = rec?.cause && typeof rec.cause === "object" ? (rec.cause as Record<string, unknown>) : null;
  const direct = [rec?.reason, nested?.reason].find((v) => typeof v === "string" && v.trim());
  if (typeof direct === "string") {
    const token = direct.trim().replace(/^['"]|['"]$/g, "");
    if (token) return token;
  }
  const text = collectText(err);
  const patterns = [
    /reverted with the following reason:\s*["']?([a-z0-9_]+)/i,
    /execution reverted(?::\s*["']?([a-z0-9_]+))?/i,
    /\breason:\s*["']?([a-z0-9_]+)/i,
    /\breverted:\s*["']?([a-z0-9_]+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1];
  }
  const lone = text.trim();
  if (/^[a-z0-9_]{1,12}$/i.test(lone) && REASONS[lone.toLowerCase()]) return lone.toLowerCase();
  return null;
}

export function friendlyChainError(err: unknown): string {
  const text = collectText(err);
  const lower = text.toLowerCase();

  if (
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("rejected the request") ||
    lower.includes("action_rejected") ||
    /\b4001\b/.test(lower)
  ) {
    return "Wallet rejected the transaction.";
  }
  if (
    lower.includes("insufficient funds") ||
    lower.includes("exceeds the balance") ||
    lower.includes("insufficient balance") ||
    lower.includes("gas required exceeds")
  ) {
    return "Not enough funds for this purchase plus gas. Claim DxDAI or top up xDAI, then retry.";
  }
  if (lower.includes("sold out")) {
    return "Sold out or this listing was just taken. Refresh and try another ticket.";
  }
  if (lower.includes("frozen")) return REASONS.frz;
  if (lower.includes("1 ticket per wallet")) return REASONS.one;
  if (lower.includes("index lagged")) {
    return redactSecrets(text.split("\n").map((s) => s.trim()).find(Boolean) || text);
  }

  const reason = extractRevertReason(err);
  if (reason) {
    const mapped = REASONS[reason.toLowerCase()];
    if (mapped) return mapped;
  }

  const cleaned = redactSecrets(
    text
      .replace(/^Error:\s*/i, "")
      .replace(/ContractFunctionExecutionError:\s*/gi, "")
      .replace(/ContractFunctionRevertedError:\s*/gi, "")
      .replace(/TransactionExecutionError:\s*/gi, "")
      .replace(/The contract function "[^"]+" reverted with the following reason:\s*/gi, "")
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );

  if (!cleaned) return "On-chain transaction failed. Refresh and try again.";
  if (cleaned.length > 220) return `${cleaned.slice(0, 200).trim()}…`;
  if (/execution reverted/i.test(cleaned) && cleaned.length < 40) {
    return "Sold out or this listing is no longer active. Refresh and try again.";
  }
  return cleaned;
}

export function isInventoryRace(err: unknown): boolean {
  const reason = extractRevertReason(err)?.toLowerCase();
  if (reason === "st" || reason === "inactive" || reason === "val" || reason === "ended") return true;
  const msg = friendlyChainError(err).toLowerCase();
  return (
    msg.includes("sold out") ||
    msg.includes("no longer active") ||
    msg.includes("refresh and try") ||
    msg.includes("has ended")
  );
}
