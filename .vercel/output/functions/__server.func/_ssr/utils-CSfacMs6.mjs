import { n as clsx } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/utils-CSfacMs6.js
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function shortAddr(addr) {
	if (!addr || addr.length < 10) return addr;
	return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
function formatAmount(cents, symbol = "xDAI") {
	return `${(cents / 100).toFixed(2)} ${symbol}`;
}
function paySymbol(config) {
	if (config?.devMode) return "DxDAI";
	return config?.nativeSymbol ?? "xDAI";
}
function checkInPct(rate) {
	return `${Math.round(rate * 100)}%`;
}
function priceBounds(faceCents) {
	return {
		min: Math.floor(faceCents * 90 / 100),
		max: Math.floor(faceCents * 110 / 100)
	};
}
function eventPhase(opts) {
	if (opts.cancelled) return "cancelled";
	if (new Date(opts.endsAt).getTime() < Date.now()) return "ended";
	return "active";
}
function phaseLabel(phase) {
	if (phase === "cancelled") return "Cancelled";
	if (phase === "ended") return "Ended";
	return "Active";
}
//#endregion
export { paySymbol as a, shortAddr as c, formatAmount as i, cn as n, phaseLabel as o, eventPhase as r, priceBounds as s, checkInPct as t };
