import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeFunctionData,
  formatEther,
  http,
  parseEventLogs,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import artifacts from "@/lib/abi/core.json";
import { readPlatform } from "@/lib/platform";
import { getSql } from "@/lib/db";
import { loadInfra } from "@/lib/infra.server";
import { RECEIPT_CONFIRMATIONS, RECEIPT_TIMEOUT_MS } from "@/lib/receipt";

const globalRef = globalThis as typeof globalThis & {
  __ctLastChainError__?: string | null;
  __ctLastAnchor__?: { hash: string; at: string; kind: string } | null;
};

async function cfg() {
  const sql = await getSql();
  const infra = await loadInfra(sql);
  const file = readPlatform();
  return {
    ...infra,
    rpcUrl: infra.rpcUrl || file.rpcUrl,
    chainId: infra.chainId || file.chainId,
    explorerUrl: infra.explorerUrl || file.explorerUrl,
    nativeSymbol: file.nativeSymbol,
  };
}

function chainOf(chainId: number, rpcUrl: string, explorerUrl: string) {
  const file = readPlatform();
  return defineChain({
    id: chainId,
    name: file.chainName || "Ticket network",
    nativeCurrency: { name: file.nativeSymbol, symbol: file.nativeSymbol, decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    blockExplorers: { default: { name: "Explorer", url: explorerUrl || file.explorerUrl } },
  });
}

export async function readClient() {
  const c = await cfg();
  const chain = chainOf(c.chainId, c.rpcUrl, c.explorerUrl);
  const publicClient = createPublicClient({ chain, transport: http(c.rpcUrl, { timeout: 20_000 }) });
  return { c, chain, publicClient };
}

export async function clients() {
  const base = await readClient();
  if (!base.c.operatorPk) throw new Error("Set an operator private key in Admin before writing on-chain.");
  const account = privateKeyToAccount(base.c.operatorPk as `0x${string}`);
  const wallet = createWalletClient({
    account,
    chain: base.chain,
    transport: http(base.c.rpcUrl, { timeout: 40_000 }),
  });
  return { ...base, account, wallet };
}

export async function pingChain(rpcUrl?: string, chainId?: number) {
  const sql = await getSql();
  const infra = await loadInfra(sql);
  const file = readPlatform();
  const rpc = rpcUrl || infra.rpcUrl || file.rpcUrl;
  const id = chainId || infra.chainId || file.chainId;
  const client = createPublicClient({
    chain: chainOf(id, rpc, infra.explorerUrl || file.explorerUrl),
    transport: http(rpc, { timeout: 10_000 }),
  });
  const [blockNumber, netId] = await Promise.all([client.getBlockNumber(), client.getChainId()]);
  let operatorAddress: string | null = null;
  let operatorBalance: string | null = null;
  if (infra.operatorPk) {
    const account = privateKeyToAccount(infra.operatorPk as `0x${string}`);
    operatorAddress = account.address;
    const wei = await client.getBalance({ address: account.address });
    operatorBalance = formatEther(wei);
  }
  globalRef.__ctLastChainError__ = null;
  return {
    connected: true,
    rpcUrl: rpc,
    chainId: netId,
    blockNumber: Number(blockNumber),
    operatorAddress,
    operatorBalance,
    explorerUrl: infra.explorerUrl || file.explorerUrl,
    lastError: null as string | null,
    lastAnchor: globalRef.__ctLastAnchor__ ?? null,
    demoBank: infra.demoBank || null,
    devMode: infra.devMode,
  };
}

export async function generateOperatorKey() {
  return generatePrivateKey();
}

export async function operatorAddressOf(pk: string) {
  return privateKeyToAccount(pk as `0x${string}`).address;
}

export function lastChainError() {
  return globalRef.__ctLastChainError__ ?? null;
}

export function lastAnchor() {
  return globalRef.__ctLastAnchor__ ?? null;
}

function note(hash: string, kind: string) {
  globalRef.__ctLastAnchor__ = { hash, at: new Date().toISOString(), kind };
  globalRef.__ctLastChainError__ = null;
  return hash;
}

async function wait(publicClient: Awaited<ReturnType<typeof readClient>>["publicClient"], hash: Hex) {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    timeout: RECEIPT_TIMEOUT_MS,
    confirmations: RECEIPT_CONFIRMATIONS,
  });
  if (receipt.status !== "success") throw new Error("On-chain transaction reverted.");
  return receipt;
}

export async function waitReceipt(hash: Hex) {
  const { publicClient } = await readClient();
  return wait(publicClient, hash);
}

export function centsToWei(cents: number) {
  return BigInt(cents) * 10n ** 16n;
}

export async function deployDemoBank(admin: `0x${string}`) {
  const { account, wallet, publicClient } = await clients();
  const hash = await wallet.deployContract({
    abi: artifacts.DemoBank.abi,
    bytecode: artifacts.DemoBank.bytecode as Hex,
    args: [admin, account.address],
    account,
  });
  const receipt = await wait(publicClient, hash);
  if (!receipt.contractAddress) throw new Error("DxDAI bank deploy returned no address.");
  note(hash, "demo_bank");
  return { address: receipt.contractAddress, tx: hash };
}

export async function assertDemoBank(bank: `0x${string}`) {
  const { publicClient } = await readClient();
  let name = "";
  try {
    name = (await publicClient.readContract({
      address: bank,
      abi: artifacts.DemoBank.abi,
      functionName: "name",
    })) as string;
  } catch {
    throw new Error(
      "Saved DemoBank is not a readable DxDAI contract. Turn Dev mode off then on to mint a fresh bank.",
    );
  }
  if (name !== "Demo xDAI") {
    throw new Error(
      `Saved bank is "${name}", not DxDAI. Turn Dev mode off then on so a new 10,000 DxDAI pool is minted.`,
    );
  }
}

export async function deployEventContracts(opts: {
  organizer: `0x${string}`;
  endsAtSec: number;
  royaltyBps: number;
  bank: `0x${string}` | null;
  name: string;
  onStep?: (index: number) => Promise<void>;
}) {
  const { account, wallet, publicClient } = await clients();
  if (opts.bank) await assertDemoBank(opts.bank);

  await opts.onStep?.(1);
  const vaultHash = await wallet.deployContract({
    abi: artifacts.EventVault.abi,
    bytecode: artifacts.EventVault.bytecode as Hex,
    args: [opts.organizer, account.address, BigInt(opts.endsAtSec)],
    account,
  });
  const vaultReceipt = await wait(publicClient, vaultHash);
  const vault = vaultReceipt.contractAddress as `0x${string}`;
  if (!vault) throw new Error("Vault deploy returned no address.");

  await opts.onStep?.(2);
  const mktHash = await wallet.deployContract({
    abi: artifacts.EventMarketplace.abi,
    bytecode: artifacts.EventMarketplace.bytecode as Hex,
    args: [
      opts.organizer,
      vault,
      account.address,
      opts.bank ?? "0x0000000000000000000000000000000000000000",
      opts.royaltyBps,
      BigInt(opts.endsAtSec),
    ],
    account,
  });
  const mktReceipt = await wait(publicClient, mktHash);
  const marketplace = mktReceipt.contractAddress as `0x${string}`;
  if (!marketplace) throw new Error("Marketplace deploy returned no address.");

  await opts.onStep?.(3);
  const bindHash = await wallet.writeContract({
    address: vault,
    abi: artifacts.EventVault.abi,
    functionName: "setMarketplace",
    args: [marketplace],
    account,
  });
  await wait(publicClient, bindHash);

  const colName = (opts.name || "ChainTicket").slice(0, 40);
  await opts.onStep?.(4);
  const colHash = await wallet.deployContract({
    abi: artifacts.TicketCollection.abi,
    bytecode: artifacts.TicketCollection.bytecode as Hex,
    args: [colName, "CTIX", opts.organizer, account.address, marketplace],
    account,
  });
  const colReceipt = await wait(publicClient, colHash);
  const collection = colReceipt.contractAddress as `0x${string}`;
  if (!collection) throw new Error("Ticket collection deploy returned no address.");

  await opts.onStep?.(5);
  const setCol = await wallet.writeContract({
    address: marketplace,
    abi: artifacts.EventMarketplace.abi,
    functionName: "setCollection",
    args: [collection],
    account,
  });
  await wait(publicClient, setCol);

  if (opts.bank) {
    try {
      await opts.onStep?.(6);
      const allow = await wallet.writeContract({
        address: opts.bank,
        abi: artifacts.DemoBank.abi,
        functionName: "setMarket",
        args: [marketplace, true],
        account,
      });
      await wait(publicClient, allow);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "setMarket reverted";
      throw new Error(
        `DemoBank setMarket failed (${msg}). Turn Dev mode off then on to mint a fresh DxDAI bank, then mint the event again.`,
      );
    }
  }

  note(colHash, "collection");
  return {
    vault,
    marketplace,
    collection,
    vaultTx: vaultHash,
    marketTx: mktHash,
    collectionTx: colHash,
    bindTx: bindHash,
  };
}

export async function setTierUriOnChain(opts: {
  marketplace: `0x${string}`;
  tierId: number;
  uri: string;
}) {
  const { account, wallet, publicClient } = await clients();
  const hash = await wallet.writeContract({
    address: opts.marketplace,
    abi: artifacts.EventMarketplace.abi,
    functionName: "setTierURI",
    args: [opts.tierId, opts.uri],
    account,
  });
  await wait(publicClient, hash);
  note(hash, "uri");
  return hash;
}

export async function mintTierOnChain(opts: {
  marketplace: `0x${string}`;
  tierId: number;
  supply: number;
  faceCents: number;
}) {
  const { account, wallet, publicClient } = await clients();
  const hash = await wallet.writeContract({
    address: opts.marketplace,
    abi: artifacts.EventMarketplace.abi,
    functionName: "mintTier",
    args: [opts.tierId, opts.supply, centsToWei(opts.faceCents)],
    account,
  });
  await wait(publicClient, hash);
  note(hash, "mint");
  return hash;
}

export async function verifyUserBuy(opts: {
  txHash: Hex;
  buyer: `0x${string}`;
  marketplace: `0x${string}`;
  ticketId: number;
}) {
  const { publicClient } = await readClient();
  const receipt = await wait(publicClient, opts.txHash);
  if (receipt.from.toLowerCase() !== opts.buyer.toLowerCase()) {
    throw new Error("Buy transaction was not sent from your wallet.");
  }
  if ((receipt.to ?? "").toLowerCase() !== opts.marketplace.toLowerCase()) {
    throw new Error("Buy transaction did not hit this event’s marketplace.");
  }
  const bought = parseEventLogs({
    abi: artifacts.EventMarketplace.abi,
    logs: receipt.logs,
    eventName: "Bought",
  }) as unknown as { args: { id: bigint; buyer: `0x${string}`; price: bigint; primary: boolean } }[];
  const match = bought.find((l) => Number(l.args.id) === opts.ticketId);
  if (!match) throw new Error("On-chain Bought event not found for this ticket.");
  note(opts.txHash, "buy");
  return {
    hash: opts.txHash,
    id: Number(match.args.id),
    priceWei: match.args.price,
    priceCents: Number(match.args.price / 10n ** 16n),
    primary: Boolean(match.args.primary),
  };
}

export async function verifyUserList(opts: {
  txHash: Hex;
  seller: `0x${string}`;
  marketplace: `0x${string}`;
  ticketId: number;
}) {
  const { publicClient } = await readClient();
  const receipt = await wait(publicClient, opts.txHash);
  if (receipt.from.toLowerCase() !== opts.seller.toLowerCase()) {
    throw new Error("List transaction was not sent from your wallet.");
  }
  const listed = parseEventLogs({
    abi: artifacts.EventMarketplace.abi,
    logs: receipt.logs,
    eventName: "Listed",
  }) as unknown as { args: { id: bigint } }[];
  if (!listed.some((l) => Number(l.args.id) === opts.ticketId)) {
    throw new Error("On-chain Listed event not found.");
  }
  note(opts.txHash, "list");
  return opts.txHash;
}

export async function verifyUserDelist(opts: {
  txHash: Hex;
  owner: `0x${string}`;
  marketplace: `0x${string}`;
  ticketId: number;
}) {
  const { publicClient } = await readClient();
  const receipt = await wait(publicClient, opts.txHash);
  if (receipt.from.toLowerCase() !== opts.owner.toLowerCase()) {
    throw new Error("Delist transaction was not sent from your wallet.");
  }
  const logs = parseEventLogs({
    abi: artifacts.EventMarketplace.abi,
    logs: receipt.logs,
    eventName: "Delisted",
  }) as unknown as { args: { id: bigint } }[];
  if (!logs.some((l) => Number(l.args.id) === opts.ticketId)) {
    throw new Error("On-chain Delisted event not found.");
  }
  note(opts.txHash, "delist");
  return opts.txHash;
}

export async function verifyCheckIn(opts: {
  txHash: Hex;
  marketplace: `0x${string}`;
  ticketId: number;
}) {
  const { publicClient } = await readClient();
  const receipt = await wait(publicClient, opts.txHash);
  if ((receipt.to ?? "").toLowerCase() !== opts.marketplace.toLowerCase()) {
    throw new Error("Check-in transaction did not hit this event’s marketplace.");
  }
  const logs = parseEventLogs({
    abi: artifacts.EventMarketplace.abi,
    logs: receipt.logs,
    eventName: "CheckedIn",
  }) as unknown as { args: { id: bigint } }[];
  if (!logs.some((l) => Number(l.args.id) === opts.ticketId)) {
    throw new Error("On-chain CheckedIn event not found.");
  }
  note(opts.txHash, "checkin");
  return opts.txHash;
}

export async function submitCheckIn(opts: { marketplace: `0x${string}`; id: number }) {
  const { account, wallet, publicClient } = await clients();
  const hash = await wallet.writeContract({
    address: opts.marketplace,
    abi: artifacts.EventMarketplace.abi,
    functionName: "checkIn",
    args: [BigInt(opts.id)],
    account,
  });
  await wait(publicClient, hash);
  note(hash, "checkin");
  return hash;
}

export async function submitCancel(opts: { marketplace: `0x${string}`; ids: number[] }) {
  const { account, wallet, publicClient } = await clients();
  const mark = await wallet.writeContract({
    address: opts.marketplace,
    abi: artifacts.EventMarketplace.abi,
    functionName: "markCancelled",
    account,
  });
  await wait(publicClient, mark);
  const hashes = [mark];
  for (const id of opts.ids) {
    const hash = await wallet.writeContract({
      address: opts.marketplace,
      abi: artifacts.EventMarketplace.abi,
      functionName: "refundFace",
      args: [BigInt(id)],
      account,
    });
    await wait(publicClient, hash);
    hashes.push(hash);
  }
  note(hashes[hashes.length - 1]!, "refund");
  return hashes;
}

export async function submitWithdraw(vault: `0x${string}`, token?: `0x${string}` | null) {
  const { account, wallet, publicClient } = await clients();
  const hash = token
    ? await wallet.writeContract({
        address: vault,
        abi: artifacts.EventVault.abi,
        functionName: "withdrawToken",
        args: [token],
        account,
      })
    : await wallet.writeContract({
        address: vault,
        abi: artifacts.EventVault.abi,
        functionName: "withdraw",
        account,
      });
  await wait(publicClient, hash);
  note(hash, "withdraw");
  return hash;
}

export async function submitFrozen(opts: {
  marketplace: `0x${string}`;
  vault: `0x${string}`;
  collection?: `0x${string}` | null;
  on: boolean;
}) {
  const { account, wallet, publicClient } = await clients();
  const a = await wallet.writeContract({
    address: opts.marketplace,
    abi: artifacts.EventMarketplace.abi,
    functionName: "setFrozen",
    args: [opts.on],
    account,
  });
  await wait(publicClient, a);
  const b = await wallet.writeContract({
    address: opts.vault,
    abi: artifacts.EventVault.abi,
    functionName: "setFrozen",
    args: [opts.on],
    account,
  });
  await wait(publicClient, b);
  let collectionTx: Hex | null = null;
  if (opts.collection) {
    collectionTx = await wallet.writeContract({
      address: opts.collection,
      abi: artifacts.TicketCollection.abi,
      functionName: "setFrozen",
      args: [opts.on],
      account,
    });
    await wait(publicClient, collectionTx);
  }
  note(collectionTx ?? b, opts.on ? "freeze" : "unfreeze");
  return { marketTx: a, vaultTx: b, collectionTx };
}

export async function readOwnerOf(collection: `0x${string}`, id: number) {
  const { publicClient } = await readClient();
  return (await publicClient.readContract({
    address: collection,
    abi: artifacts.TicketCollection.abi,
    functionName: "ownerOf",
    args: [BigInt(id)],
  })) as `0x${string}`;
}

export async function readVaultGov(vault: `0x${string}`, engineVersion = 3) {
  const { publicClient } = await readClient();
  const read = <T>(functionName: string) =>
    publicClient.readContract({
      address: vault,
      abi: artifacts.EventVault.abi,
      functionName,
    }) as Promise<T>;
  const [govLocked, withdrawAllowed, escalated, yesWeight, soldWeight, voteDeadline, materialsURI, withdrawn, frozen] =
    await Promise.all([
      read<boolean>("govLocked"),
      read<boolean>("withdrawAllowed"),
      read<boolean>("escalated"),
      read<bigint>(engineVersion >= 4 ? "objectionWeight" : "yesWeight"),
      read<bigint>("soldWeight"),
      read<bigint>("voteDeadline"),
      read<string>("materialsURI"),
      read<boolean>("withdrawn"),
      read<boolean>("frozen"),
    ]);
  return {
    govLocked,
    withdrawAllowed,
    escalated,
    yesWeight: Number(yesWeight),
    objectionWeight: engineVersion >= 4 ? Number(yesWeight) : 0,
    soldWeight: Number(soldWeight),
    voteDeadline: Number(voteDeadline),
    materialsURI,
    withdrawn,
    frozen,
  };
}

export async function submitRequestWithdraw(marketplace: `0x${string}`) {
  const { account, wallet, publicClient } = await clients();
  const hash = await wallet.writeContract({
    address: marketplace,
    abi: artifacts.EventMarketplace.abi,
    functionName: "requestWithdraw",
    account,
  });
  await wait(publicClient, hash);
  note(hash, "withdraw_request");
  return hash;
}

export async function submitExecuteWithdraw(opts: {
  marketplace: `0x${string}`;
  token?: `0x${string}` | null;
}) {
  const { account, wallet, publicClient } = await clients();
  const hash = await wallet.writeContract({
    address: opts.marketplace,
    abi: artifacts.EventMarketplace.abi,
    functionName: "executeWithdraw",
    args: [opts.token ?? "0x0000000000000000000000000000000000000000"],
    account,
  });
  await wait(publicClient, hash);
  note(hash, "withdraw");
  return hash;
}

export async function submitEscalate(opts: { marketplace: `0x${string}`; uri: string }) {
  const { account, wallet, publicClient } = await clients();
  const hash = await wallet.writeContract({
    address: opts.marketplace,
    abi: artifacts.EventMarketplace.abi,
    functionName: "escalate",
    args: [opts.uri],
    account,
  });
  await wait(publicClient, hash);
  note(hash, "escalate");
  return hash;
}

export async function submitAdminDecide(opts: {
  vault: `0x${string}`;
  approve: boolean;
  token?: `0x${string}` | null;
}) {
  const { account, wallet, publicClient } = await clients();
  const decide = await wallet.writeContract({
    address: opts.vault,
    abi: artifacts.EventVault.abi,
    functionName: "adminDecide",
    args: [opts.approve],
    account,
  });
  await wait(publicClient, decide);
  if (!opts.approve) {
    note(decide, "withdraw_reject");
    return { decideTx: decide, withdrawTx: null as Hex | null };
  }
  const withdrawTx = opts.token
    ? await wallet.writeContract({
        address: opts.vault,
        abi: artifacts.EventVault.abi,
        functionName: "withdrawToken",
        args: [opts.token],
        account,
      })
    : await wallet.writeContract({
        address: opts.vault,
        abi: artifacts.EventVault.abi,
        functionName: "withdraw",
        account,
      });
  await wait(publicClient, withdrawTx);
  note(withdrawTx, "withdraw");
  return { decideTx: decide, withdrawTx };
}

export async function verifyUserVote(opts: {
  txHash: Hex;
  voter: `0x${string}`;
  marketplace: `0x${string}`;
  ticketId: number;
}) {
  const { publicClient } = await readClient();
  const receipt = await wait(publicClient, opts.txHash);
  if (receipt.from.toLowerCase() !== opts.voter.toLowerCase()) {
    throw new Error("Vote transaction was not sent from your wallet.");
  }
  const logs = parseEventLogs({
    abi: artifacts.EventMarketplace.abi,
    logs: receipt.logs,
    eventName: "Voted",
  }) as unknown as { args: { id: bigint; voter: `0x${string}` } }[];
  if (!logs.some((l) => Number(l.args.id) === opts.ticketId)) {
    throw new Error("On-chain Voted event not found for this ticket.");
  }
  note(opts.txHash, "vote");
  return opts.txHash;
}


export function claimDemoTx(bank: `0x${string}`) {
  return {
    to: bank,
    abi: artifacts.DemoBank.abi,
    functionName: "claim" as const,
    args: [] as const,
    data: encodeFunctionData({ abi: artifacts.DemoBank.abi, functionName: "claim" }),
    value: 0n,
  };
}

export async function bankBalance(bank: `0x${string}`, holder: `0x${string}`) {
  const { publicClient } = await readClient();
  return (await publicClient.readContract({
    address: bank,
    abi: artifacts.DemoBank.abi,
    functionName: "balanceOf",
    args: [holder],
  })) as bigint;
}

/** DxDAI has no ERC-20 allowance. Markets pull only if the operator allow-listed them. */
export async function marketPullAllowed(bank: `0x${string}`, market: `0x${string}`) {
  const { publicClient } = await readClient();
  return (await publicClient.readContract({
    address: bank,
    abi: artifacts.DemoBank.abi,
    functionName: "markets",
    args: [market],
  })) as boolean;
}

export async function demoStatus(bank: `0x${string}`, holder: `0x${string}`) {
  const { publicClient } = await readClient();
  const [dripped, balance] = await Promise.all([
    publicClient.readContract({
      address: bank,
      abi: artifacts.DemoBank.abi,
      functionName: "dripped",
      args: [holder],
    }) as Promise<boolean>,
    publicClient.readContract({
      address: bank,
      abi: artifacts.DemoBank.abi,
      functionName: "balanceOf",
      args: [holder],
    }) as Promise<bigint>,
  ]);
  return { dripped, balance: balance.toString(), cents: Number(balance / 10n ** 16n) };
}

export async function ensureNativeGas(to: `0x${string}`) {
  const { account, wallet, publicClient } = await clients();
  const bal = await publicClient.getBalance({ address: to });
  const min = 2n * 10n ** 16n;
  const topup = 5n * 10n ** 16n;
  if (bal >= min) return null;
  const opBal = await publicClient.getBalance({ address: account.address });
  if (opBal < topup + min) {
    throw new Error("Operator wallet needs testnet xDAI so preview wallets can pay gas.");
  }
  const hash = await wallet.sendTransaction({
    account,
    to,
    value: topup,
  });
  await wait(publicClient, hash);
  note(hash, "gas");
  return hash;
}

export async function dripDemo(to: `0x${string}`, amountWei = 100n * 10n ** 18n) {
  const sql = await getSql();
  const infra = await loadInfra(sql);
  if (!infra.devMode || !infra.demoBank) throw new Error("Dev mode is off.");
  await assertDemoBank(infra.demoBank as `0x${string}`);
  const { account, wallet, publicClient } = await clients();
  const hash = await wallet.writeContract({
    address: infra.demoBank as `0x${string}`,
    abi: artifacts.DemoBank.abi,
    functionName: "drip",
    args: [to, amountWei],
    account,
  });
  await wait(publicClient, hash);
  note(hash, "drip");
  return hash;
}
