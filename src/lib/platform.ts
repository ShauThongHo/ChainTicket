import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { isAddress, getAddress } from "viem";

export type PlatformFile = {
  adminWallet: string;
  chainName: string;
  nativeSymbol: string;
  rpcUrl: string;
  chainId: number;
  explorerUrl: string;
  /** Leftover field. Operator keys live in the database, not this bootstrap file. */
  secretsPath: string;
};

export const DEFAULT_SECRETS_PATH = ".data/operator-secrets.json";

/** Project config next to the process, with the sandbox file as a fallback. */
export function resolvePlatformPath() {
  const fromCwd = join(process.cwd(), "config", "platform.json");
  const workspace = join("/workspace", "config", "platform.json");
  if (existsSync(fromCwd)) return fromCwd;
  if (fromCwd !== workspace && existsSync(workspace)) return workspace;
  return fromCwd;
}

export const PLATFORM_PATH = resolvePlatformPath();

const FALLBACK: PlatformFile = {
  adminWallet: "",
  chainName: "Testnet",
  nativeSymbol: "xDAI",
  rpcUrl: "https://rpc.chiadochain.net",
  chainId: 10200,
  explorerUrl: "https://gnosis-chiado.blockscout.com",
  secretsPath: DEFAULT_SECRETS_PATH,
};

export function readPlatform(): PlatformFile {
  const path = resolvePlatformPath();
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<PlatformFile>;
    return {
      adminWallet: (parsed.adminWallet ?? "").trim(),
      chainName: (parsed.chainName ?? FALLBACK.chainName).trim() || FALLBACK.chainName,
      nativeSymbol: (parsed.nativeSymbol ?? FALLBACK.nativeSymbol).trim() || FALLBACK.nativeSymbol,
      rpcUrl: (parsed.rpcUrl ?? FALLBACK.rpcUrl).trim(),
      chainId: Number(parsed.chainId) || FALLBACK.chainId,
      explorerUrl: (parsed.explorerUrl ?? FALLBACK.explorerUrl).trim(),
      secretsPath: (parsed.secretsPath ?? FALLBACK.secretsPath).trim() || FALLBACK.secretsPath,
    };
  } catch {
    return { ...FALLBACK };
  }
}

const SECRET_FIELDS = [
  "operatorPk",
  "pinataJwt",
  "databaseUrl",
  "databaseUrlKyc",
  "operator_pk",
  "pinata_jwt",
  "privateKey",
  "kycAesKey",
  "kycHmacPepper",
  "KYC_AES_KEY",
  "KYC_HMAC_PEPPER",
  "DATABASE_URL_KYC",
];

export function writePlatform(patch: Partial<PlatformFile>) {
  const clean = { ...patch } as Partial<PlatformFile> & Record<string, unknown>;
  for (const key of SECRET_FIELDS) delete clean[key];
  const next = { ...readPlatform(), ...clean };
  for (const key of SECRET_FIELDS) delete (next as Record<string, unknown>)[key];
  if (next.adminWallet && !isAddress(next.adminWallet)) {
    throw new Error("Admin wallet is not a valid address.");
  }
  if (next.adminWallet) next.adminWallet = getAddress(next.adminWallet);
  if (next.secretsPath) next.secretsPath = next.secretsPath.trim() || DEFAULT_SECRETS_PATH;
  const path = resolvePlatformPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

export function configuredAdmin() {
  const w = readPlatform().adminWallet;
  return w ? w.toLowerCase() : "";
}

export function secretsFilePath() {
  const raw = readPlatform().secretsPath || DEFAULT_SECRETS_PATH;
  return isAbsolute(raw) ? raw : join("/workspace", raw);
}

export function explorerTx(hash: string, explorer?: string) {
  const base = (explorer || readPlatform().explorerUrl).replace(/\/$/, "");
  return `${base}/tx/${hash}`;
}

export function explorerAddress(addr: string, explorer?: string) {
  const base = (explorer || readPlatform().explorerUrl).replace(/\/$/, "");
  return `${base}/address/${addr}`;
}

export function isOnChainTx(ref: string) {
  return /^0x[0-9a-fA-F]{64}$/.test(ref);
}
