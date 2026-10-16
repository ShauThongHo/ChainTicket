import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  type Abi,
  type EIP1193Provider,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { toChainHex } from "@/lib/explorer";
import { RECEIPT_CONFIRMATIONS, RECEIPT_TIMEOUT_MS } from "@/lib/receipt";
import { friendlyChainError } from "@/lib/chain-errors";
import type { PublicConfig } from "@/lib/types";

const PREVIEW_KEY = "ct_preview_pk";
export const SESSION_KEY = "ct_session";
const MODE_KEY = "ct_wallet_mode";

export type InjectedWallet = {
  uuid: string;
  name: string;
  icon?: string;
  provider: EIP1193Provider;
};

type Eip6963Detail = {
  info: { uuid: string; name: string; icon: string };
  provider: EIP1193Provider;
};

export type UserCall = {
  to: `0x${string}`;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
};

let injectedProvider: EIP1193Provider | null = null;

export function rememberInjected(provider: EIP1193Provider | null) {
  injectedProvider = provider;
}

export function discoverWallets(): InjectedWallet[] {
  if (typeof window === "undefined") return [];
  const found = new Map<string, InjectedWallet>();
  const onAnnounce = (event: Event) => {
    const detail = (event as CustomEvent<Eip6963Detail>).detail;
    if (!detail?.provider) return;
    found.set(detail.info.uuid, {
      uuid: detail.info.uuid,
      name: detail.info.name,
      icon: detail.info.icon,
      provider: detail.provider,
    });
  };
  window.addEventListener("eip6963:announceProvider", onAnnounce as EventListener);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  window.removeEventListener("eip6963:announceProvider", onAnnounce as EventListener);
  if (found.size === 0) {
    const eth = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
    if (eth) {
      found.set("injected", { uuid: "injected", name: "Browser wallet", provider: eth });
    }
  }
  return [...found.values()];
}

function currentProvider(): EIP1193Provider | null {
  if (injectedProvider) return injectedProvider;
  if (typeof window !== "undefined" && localStorage.getItem(MODE_KEY) === "injected") {
    return discoverWallets()[0]?.provider ?? null;
  }
  return null;
}

function chainOf(net: PublicConfig) {
  return defineChain({
    id: net.chainId,
    name: net.chainName || "Ticket network",
    nativeCurrency: { name: net.nativeSymbol, symbol: net.nativeSymbol, decimals: 18 },
    rpcUrls: { default: { http: [net.rpcUrl] } },
    blockExplorers: { default: { name: "Explorer", url: net.explorerUrl } },
  });
}

export async function switchNetwork(provider: EIP1193Provider, net: PublicConfig) {
  const chainId = toChainHex(net.chainId);
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId,
            chainName: net.chainName,
            nativeCurrency: { name: net.nativeSymbol, symbol: net.nativeSymbol, decimals: 18 },
            rpcUrls: [net.rpcUrl],
            blockExplorerUrls: [net.explorerUrl],
          },
        ],
      });
      return;
    }
    throw err;
  }
}

export async function connectInjected(provider: EIP1193Provider, net: PublicConfig) {
  rememberInjected(provider);
  await switchNetwork(provider, net).catch(() => undefined);
  const client = createWalletClient({
    transport: custom(provider),
  });
  const addresses = await client.requestAddresses();
  const address = addresses[0];
  if (!address) throw new Error("No account returned.");
  return { client, address, chainId: net.chainId };
}

export function getPreviewAccount() {
  rememberInjected(null);
  let pk = localStorage.getItem(PREVIEW_KEY) as `0x${string}` | null;
  if (!pk) {
    pk = generatePrivateKey();
    localStorage.setItem(PREVIEW_KEY, pk);
  }
  return privateKeyToAccount(pk);
}

export async function sendUserCall(
  net: PublicConfig,
  call: UserCall,
  hooks?: { onSubmitted?: (hash: Hex) => void },
): Promise<Hex> {
  try {
    const chain = chainOf(net);
    const publicClient = createPublicClient({
      chain,
      transport: http(net.rpcUrl, { timeout: 40_000 }),
    });
    const provider = currentProvider();
    const mode = typeof window !== "undefined" ? localStorage.getItem(MODE_KEY) : null;
    let hash: Hex;
    if (mode === "injected" && provider) {
      const wallet = createWalletClient({ chain, transport: custom(provider) });
      const [account] = await wallet.getAddresses();
      if (!account) throw new Error("Connect a wallet first.");
      hash = await wallet.writeContract({
        address: call.to,
        abi: call.abi as Abi,
        functionName: call.functionName,
        args: call.args as readonly unknown[],
        value: call.value,
        account,
        chain,
      });
    } else {
      const pk = typeof window !== "undefined" ? (localStorage.getItem(PREVIEW_KEY) as `0x${string}` | null) : null;
      if (!pk) throw new Error("Connect a wallet first.");
      const account = privateKeyToAccount(pk);
      const wallet = createWalletClient({
        account,
        chain,
        transport: http(net.rpcUrl, { timeout: 40_000 }),
      });
      hash = await wallet.writeContract({
        address: call.to,
        abi: call.abi as Abi,
        functionName: call.functionName,
        args: call.args as readonly unknown[],
        value: call.value,
        account,
        chain,
      });
    }
    hooks?.onSubmitted?.(hash);
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: RECEIPT_TIMEOUT_MS,
      confirmations: RECEIPT_CONFIRMATIONS,
    });
    if (receipt.status !== "success") {
      throw new Error("Sold out or this listing is no longer active. Refresh and try again.");
    }
    return hash;
  } catch (err) {
    throw new Error(friendlyChainError(err));
  }
}

export function saveSession(token: string, mode: "preview" | "injected" = "preview") {
  localStorage.setItem(SESSION_KEY, token);
  localStorage.setItem(MODE_KEY, mode);
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(MODE_KEY);
  injectedProvider = null;
}

export function readSession() {
  return localStorage.getItem(SESSION_KEY);
}

export function restoreWallet() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MODE_KEY) === "preview" && localStorage.getItem(PREVIEW_KEY)) {
    getPreviewAccount();
  }
}
