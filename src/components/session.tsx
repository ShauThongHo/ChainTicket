import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fetchMe, fetchPublicConfig, fetchSpendable, getNonce, verifyWallet } from "@/lib/api";
import type { PublicConfig, SessionMe } from "@/lib/types";
import {
  clearSession,
  connectInjected,
  discoverWallets,
  getPreviewAccount,
  readSession,
  restoreWallet,
  saveSession,
  sendUserCall as sendWalletCall,
  type InjectedWallet,
  type UserCall,
} from "@/lib/wallet";
import type { EIP1193Provider, Hex } from "viem";

type SessionCtx = {
  me: SessionMe | null;
  config: PublicConfig | null;
  loading: boolean;
  wallets: InjectedWallet[];
  refresh: () => Promise<SessionMe | null>;
  refreshBalance: (fresh?: boolean) => Promise<void>;
  connectProvider: (provider: EIP1193Provider) => Promise<SessionMe | null>;
  connectPreview: () => Promise<SessionMe | null>;
  disconnect: () => void;
  sendUserCall: (call: UserCall, hooks?: { onSubmitted?: (hash: Hex) => void }) => Promise<Hex>;
  gate: "off" | "pick" | "load";
  requestConnect: () => void;
  cancelConnect: () => void;
  markAccountLoad: () => void;
  portalFor: (user: SessionMe) => "/admin" | "/organizer" | "/marketplace";
};

const Ctx = createContext<SessionCtx | null>(null);

export function portalFor(user: SessionMe): "/admin" | "/organizer" | "/marketplace" {
  if (user.role === "admin") return "/admin";
  if (user.role === "organizer") return "/organizer";
  return "/marketplace";
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<SessionMe | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState<InjectedWallet[]>([]);
  const [gate, setGate] = useState<"off" | "pick" | "load">("off");
  const activeProvider = useRef<EIP1193Provider | null>(null);
  const [providerVersion, setProviderVersion] = useState(0);

  const refresh = useCallback(async () => {
    if (!readSession()) {
      setMe(null);
      setLoading(false);
      return null as SessionMe | null;
    }
    try {
      const data = await fetchMe();
      setMe(data);
      return data;
    } catch {
      clearSession();
      setMe(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setWallets(discoverWallets());
    restoreWallet();
    void fetchPublicConfig()
      .then(setConfig)
      .catch(() => undefined);
    void refresh();
  }, [refresh]);

  const refreshBalance = useCallback(async (fresh = false) => {
    if (!readSession()) return;
    try {
      const bal = await fetchSpendable({ data: { fresh } });
      setMe((cur) => (cur ? { ...cur, spendableCents: bal.cents } : cur));
    } catch {
      // role is already on screen; balance can stay at the indexed figure
    }
  }, []);

  useEffect(() => {
    if (!me?.address) return;
    void refreshBalance(false);
  }, [me?.address, refreshBalance]);

  const loginWithSigner = useCallback(
    async (
      address: string,
      sign: (message: string) => Promise<string>,
      mode: "preview" | "injected",
    ) => {
      const { nonce, message } = await getNonce();
      const signature = await sign(message);
      const { token } = await verifyWallet({ data: { address, signature, nonce } });
      saveSession(token, mode);
      return refresh();
    },
    [refresh],
  );

  const connectProvider = useCallback(
    async (provider: EIP1193Provider) => {
      activeProvider.current = provider;
      setProviderVersion((version) => version + 1);
      const net = config ?? (await fetchPublicConfig());
      setConfig(net);
      const { client, address } = await connectInjected(provider, net);
      const user = await loginWithSigner(
        address,
        (message) => client.signMessage({ account: address, message }),
        "injected",
      );
      return user;
    },
    [config, loginWithSigner],
  );

  const connectPreview = useCallback(async () => {
    activeProvider.current = null;
    const account = getPreviewAccount();
    const user = await loginWithSigner(
      account.address,
      (message) => account.signMessage({ message }),
      "preview",
    );
    return user;
  }, [loginWithSigner]);

  useEffect(() => {
    const provider = activeProvider.current as (EIP1193Provider & {
      on?: (event: string, listener: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
    }) | null;
    if (!provider?.on) return;
    const onAccountsChanged = (accounts: unknown) => {
      const address = Array.isArray(accounts) ? accounts[0] : null;
      if (typeof address !== "string") {
        clearSession();
        setMe(null);
        setGate("off");
        return;
      }
      setGate("load");
      void connectProvider(provider).then((user) => {
        setGate(user ? "off" : "pick");
      }).catch(() => {
        clearSession();
        setMe(null);
        setGate("pick");
      });
    };
    provider.on("accountsChanged", onAccountsChanged);
    return () => provider.removeListener?.("accountsChanged", onAccountsChanged);
  }, [connectProvider, providerVersion]);

  const disconnect = useCallback(() => {
    clearSession();
    activeProvider.current = null;
    setMe(null);
  }, []);

  const sendUserCall = useCallback(
    async (call: UserCall, hooks?: { onSubmitted?: (hash: Hex) => void }) => {
      const net = config ?? (await fetchPublicConfig());
      if (!config) setConfig(net);
      return sendWalletCall(net, call, hooks);
    },
    [config],
  );

  const requestConnect = useCallback(() => {
    setWallets(discoverWallets());
    setGate("pick");
  }, []);

  const cancelConnect = useCallback(() => setGate("off"), []);
  const markAccountLoad = useCallback(() => setGate("load"), []);

  const value = useMemo(
    () => ({
      me,
      config,
      loading,
      wallets,
      refresh,
      refreshBalance,
      connectProvider,
      connectPreview,
      disconnect,
      sendUserCall,
      portalFor,
      gate,
      requestConnect,
      cancelConnect,
      markAccountLoad,
    }),
    [
      me,
      config,
      loading,
      wallets,
      refresh,
      refreshBalance,
      connectProvider,
      connectPreview,
      disconnect,
      sendUserCall,
      gate,
      requestConnect,
      cancelConnect,
      markAccountLoad,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession");
  return ctx;
}
