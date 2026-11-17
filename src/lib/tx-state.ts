export type PersistedChainRun = {
  id: string;
  title: string;
  labels: string[];
  currentStep: number;
  status: "running" | "success" | "error";
  txHash?: string | null;
  summary?: string | null;
  error?: string | null;
  doneLabel?: string;
  timestamp: number;
  pageUrl?: string;
  resumePayload?: {
    action?: "buyNow" | "sellTicket" | "cancelListing" | "confirmVote" | string;
    data?: Record<string, unknown>;
  };
};

const CHAIN_RUN_KEY = "ct_active_chain_run";
const MAX_RUN_AGE_MS = 30 * 60 * 1000; // 30 minutes

export function loadActiveChainRun(): PersistedChainRun | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CHAIN_RUN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedChainRun;
    if (Date.now() - parsed.timestamp > MAX_RUN_AGE_MS) {
      localStorage.removeItem(CHAIN_RUN_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveActiveChainRun(run: PersistedChainRun) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAIN_RUN_KEY, JSON.stringify(run));
    window.dispatchEvent(new CustomEvent("ct:chain-run-changed", { detail: run }));
  } catch {
    // ignore local storage errors
  }
}

export function updateActiveChainRun(partial: Partial<PersistedChainRun>) {
  if (typeof window === "undefined") return;
  try {
    const current = loadActiveChainRun();
    if (!current) return;
    const updated: PersistedChainRun = {
      ...current,
      ...partial,
      timestamp: Date.now(),
    };
    localStorage.setItem(CHAIN_RUN_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("ct:chain-run-changed", { detail: updated }));
  } catch {
    // ignore
  }
}

export function clearActiveChainRun() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CHAIN_RUN_KEY);
    window.dispatchEvent(new CustomEvent("ct:chain-run-changed", { detail: null }));
  } catch {
    // ignore
  }
}

export function requestOpenChainDialog() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ct:chain-dialog-open"));
}
