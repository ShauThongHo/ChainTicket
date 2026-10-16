import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatAmount(cents: number, symbol = "xDAI") {
  return `${(cents / 100).toFixed(2)} ${symbol}`;
}

export function formatXdai(cents: number) {
  return formatAmount(cents);
}

export function paySymbol(config?: { devMode?: boolean; nativeSymbol?: string } | null) {
  if (config?.devMode) return "DxDAI";
  return config?.nativeSymbol ?? "xDAI";
}

export function checkInPct(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

export function priceBounds(faceCents: number) {
  return {
    min: Math.floor((faceCents * 90) / 100),
    max: Math.floor((faceCents * 110) / 100),
  };
}

export function maskSecret(value: string, visible = 4) {
  if (!value) return "";
  if (value.length <= visible) return "•".repeat(value.length);
  return `${"•".repeat(Math.min(18, value.length - visible))}${value.slice(-visible)}`;
}

export function maskDatabaseUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "••••";
    if (u.username) u.username = u.username.slice(0, 2) + "••";
    return u.toString();
  } catch {
    return url ? "configured" : "";
  }
}

export type EventPhase = "active" | "cancelled" | "ended";

export function eventPhase(opts: { cancelled: boolean; endsAt: string }): EventPhase {
  if (opts.cancelled) return "cancelled";
  if (new Date(opts.endsAt).getTime() < Date.now()) return "ended";
  return "active";
}

export function phaseLabel(phase: EventPhase) {
  if (phase === "cancelled") return "Cancelled";
  if (phase === "ended") return "Ended";
  return "Active";
}
