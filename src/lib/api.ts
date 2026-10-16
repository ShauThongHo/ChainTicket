import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const walletMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    let walletToken: string | undefined;
    if (typeof window !== "undefined") {
      walletToken = localStorage.getItem("ct_session") ?? undefined;
    }
    return next({ sendContext: { walletToken } });
  })
  .server(async ({ next, context }) => {
    const { parseSessionToken } = await import("@/lib/session.server");
    const wallet = parseSessionToken(context.walletToken);
    return next({ context: { wallet } });
  });

function needWallet(wallet: string | null | undefined) {
  if (!wallet) throw new Error("Connect a wallet first.");
  return wallet;
}

export const getNonce = createServerFn({ method: "POST" }).handler(async () => {
  const { getSql } = await import("@/lib/db");
  const { issueNonce, loginMessage } = await import("@/lib/session.server");
  const { boot } = await import("@/lib/engine.server");
  const sql = await getSql();
  await boot(sql);
  const nonce = await issueNonce(sql);
  return { nonce, message: loginMessage(nonce) };
});

export const verifyWallet = createServerFn({ method: "POST" })
  .validator(
    z.object({
      address: z.string(),
      signature: z.string(),
      nonce: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const { getSql } = await import("@/lib/db");
    const { consumeNonce, signSessionToken, verifyLoginSignature } = await import(
      "@/lib/session.server"
    );
    const sql = await getSql();
    await consumeNonce(sql, data.nonce);
    const wallet = await verifyLoginSignature({
      address: data.address,
      signature: data.signature as `0x${string}`,
      nonce: data.nonce,
    });
    return { token: signSessionToken(wallet), address: wallet };
  });

export const fetchMe = createServerFn({ method: "GET" })
  .middleware([walletMiddleware])
  .handler(async ({ context }) => {
    if (!context.wallet) return null;
    const { getSql } = await import("@/lib/db");
    const { getMe } = await import("@/lib/engine.server");
    return getMe(await getSql(), context.wallet);
  });

export const fetchSpendable = createServerFn({ method: "GET" })
  .middleware([walletMiddleware])
  .validator(z.object({ fresh: z.boolean().optional() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { spendableBalance } = await import("@/lib/engine.server");
    return spendableBalance(await getSql(), wallet, Boolean(data.fresh));
  });

export const fetchEvents = createServerFn({ method: "GET" })
  .middleware([walletMiddleware])
  .validator(z.object({ q: z.string().optional() }))
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const { listEvents } = await import("@/lib/engine.server");
    return listEvents(await getSql(), data.q ?? "", context.wallet);
  });

export const fetchEvent = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.coerce.number() }))
  .handler(async ({ data }) => {
    const { getSql } = await import("@/lib/db");
    const { getEvent } = await import("@/lib/engine.server");
    return getEvent(await getSql(), data.id);
  });

export const saveKyc = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(
    z.object({
      fullName: z.string().trim().min(2).max(120),
      idNumber: z.string().trim().min(4).max(64),
      nationality: z.string().trim().min(2).max(80),
      documentExpiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      photoBase64: z.string().min(32).max(8_000_000),
      contentType: z.enum(["image/jpeg", "image/png"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { submitKyc } = await import("@/lib/engine.server");
    return submitKyc(await getSql(), wallet, data);
  });

export const buyNow = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(
    z.object({
      tierId: z.coerce.number(),
      txHash: z.string(),
      chainId: z.coerce.number(),
    }),
  )
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { confirmBuy } = await import("@/lib/engine.server");
    return confirmBuy(
      await getSql(),
      wallet,
      data.tierId,
      data.txHash as `0x${string}`,
      data.chainId,
    );
  });

export const quoteBuy = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(z.object({ tierId: z.coerce.number() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { quoteBuy } = await import("@/lib/engine.server");
    return quoteBuy(await getSql(), wallet, data.tierId);
  });

export const sellTicket = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(
    z.object({
      ticketId: z.coerce.number(),
      priceCents: z.coerce.number(),
      txHash: z.string(),
    }),
  )
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { listResale } = await import("@/lib/engine.server");
    return listResale(await getSql(), wallet, data.ticketId, data.priceCents, data.txHash as `0x${string}`);
  });

export const quoteList = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(z.object({ ticketId: z.coerce.number(), priceCents: z.coerce.number() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { quoteList } = await import("@/lib/engine.server");
    return quoteList(await getSql(), wallet, data.ticketId, data.priceCents);
  });

export const cancelListing = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(z.object({ ticketId: z.coerce.number(), txHash: z.string() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { delistTicket } = await import("@/lib/engine.server");
    await delistTicket(await getSql(), wallet, data.ticketId, data.txHash as `0x${string}`);
    return { ok: true as const };
  });

export const fetchMyTickets = createServerFn({ method: "GET" })
  .middleware([walletMiddleware])
  .handler(async ({ context }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { myTickets } = await import("@/lib/engine.server");
    return myTickets(await getSql(), wallet);
  });

export const fetchQr = createServerFn({ method: "GET" })
  .middleware([walletMiddleware])
  .validator(z.object({ ticketId: z.coerce.number() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { issueQr } = await import("@/lib/engine.server");
    return issueQr(await getSql(), wallet, data.ticketId);
  });

export const scanCheckIn = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(z.object({ payload: z.string() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { checkIn } = await import("@/lib/engine.server");
    return checkIn(await getSql(), wallet, data.payload);
  });

export const createEvent = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(
    z.object({
      name: z.string(),
      description: z.string(),
      venue: z.string(),
      category: z.string(),
      posterUrl: z.string(),
      startsAt: z.string(),
      endsAt: z.string(),
      jobId: z.string().min(1).max(80),
      tiers: z.array(
        z.object({
          name: z.string(),
          faceCents: z.coerce.number(),
          supply: z.coerce.number(),
        }),
      ),
    }),
  )
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const { boot, mintEvent, failMintJob } = await import("@/lib/engine.server");
    await boot(sql);
    await sql`insert into mint_jobs (id, organizer_wallet, status) values (${data.jobId}, ${wallet}, 'pending')`;
    try {
      return await mintEvent(sql, wallet, data, data.jobId);
    } catch (err) {
      await failMintJob(sql, wallet, data.jobId, err instanceof Error ? err.message : "Event creation failed.");
      throw err;
    }
  });

export const fetchMintProgress = createServerFn({ method: "GET" })
  .middleware([walletMiddleware])
  .validator(z.object({ jobId: z.string().min(1).max(80) }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { mintJobProgress } = await import("@/lib/engine.server");
    return mintJobProgress(await getSql(), wallet, data.jobId);
  });

export const fetchOrganizer = createServerFn({ method: "GET" })
  .middleware([walletMiddleware])
  .handler(async ({ context }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { organizerEvents } = await import("@/lib/engine.server");
    const sql = await getSql();
    return { events: await organizerEvents(sql, wallet) };
  });

export const fetchOrganizerEventLedger = createServerFn({ method: "GET" })
  .middleware([walletMiddleware])
  .validator(z.object({ eventId: z.coerce.number() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { organizerEventLedger } = await import("@/lib/engine.server");
    return organizerEventLedger(await getSql(), wallet, data.eventId);
  });

export const refundEvent = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(z.object({ eventId: z.coerce.number() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { cancelEvent } = await import("@/lib/engine.server");
    await cancelEvent(await getSql(), wallet, data.eventId);
    return { ok: true as const };
  });

export const withdrawEvent = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(z.object({ eventId: z.coerce.number() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { withdrawVault } = await import("@/lib/engine.server");
    const ref = await withdrawVault(await getSql(), wallet, data.eventId);
    return { ref };
  });

export const fetchRoyalty = createServerFn({ method: "GET" }).handler(async () => {
  const { getSql } = await import("@/lib/db");
  const { royaltyBps, adminCount, listAdmins } = await import("@/lib/engine.server");
  const sql = await getSql();
  return {
    royaltyBps: await royaltyBps(sql),
    adminCount: await adminCount(sql),
    admins: await listAdmins(sql),
  };
});

export const saveRoyalty = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(z.object({ bps: z.coerce.number() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { setRoyalty } = await import("@/lib/engine.server");
    await setRoyalty(await getSql(), wallet, data.bps);
    return { ok: true as const };
  });

export const saveOrganizer = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(z.object({ wallet: z.string(), name: z.string() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { addOrganizer } = await import("@/lib/engine.server");
    await addOrganizer(await getSql(), wallet, data.wallet, data.name);
    return { ok: true as const };
  });

export const patchOrganizer = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(
    z.object({
      wallet: z.string(),
      status: z.enum(["approved", "revoked", "pending"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { setOrganizerStatus } = await import("@/lib/engine.server");
    await setOrganizerStatus(await getSql(), wallet, data.wallet, data.status);
    return { ok: true as const };
  });

export const fetchOrganizers = createServerFn({ method: "GET" })
  .middleware([walletMiddleware])
  .handler(async ({ context }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { listOrganizers } = await import("@/lib/engine.server");
    return listOrganizers(await getSql(), wallet);
  });

export const fetchInfra = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .handler(async ({ context }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { getInfraStatus } = await import("@/lib/engine.server");
    return getInfraStatus(await getSql(), wallet);
  });

export const saveInfra = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(
    z.object({
      databaseUrl: z.string().optional(),
      rpcUrl: z.string().optional(),
      chainId: z.coerce.number().optional(),
      chainName: z.string().optional(),
      nativeSymbol: z.string().optional(),
      explorerUrl: z.string().optional(),
      operatorPk: z.string().optional(),
      pinataJwt: z.string().optional(),
      clearOperatorPk: z.boolean().optional(),
      clearDatabaseUrl: z.boolean().optional(),
      clearPinata: z.boolean().optional(),
      devMode: z.boolean().optional(),
      databaseUrlKyc: z.string().optional(),
      clearDatabaseUrlKyc: z.boolean().optional(),
      kycAutoApprove: z.boolean().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { applyInfra } = await import("@/lib/engine.server");
    return applyInfra(await getSql(), wallet, data);
  });

export const testDatabase = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(z.object({ url: z.string() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { probeDatabaseUrl } = await import("@/lib/engine.server");
    return probeDatabaseUrl(wallet, data.url);
  });

export const testChain = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(
    z.object({
      rpcUrl: z.string().optional(),
      chainId: z.coerce.number().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { getMe } = await import("@/lib/engine.server");
    const me = await getMe(await getSql(), wallet);
    if (!me.isAdmin) throw new Error("Admin only.");
    const { pingChain } = await import("@/lib/chain.server");
    return pingChain(data.rpcUrl, data.chainId);
  });

export const makeOperatorKey = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .handler(async ({ context }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { getMe, applyInfra } = await import("@/lib/engine.server");
    const me = await getMe(await getSql(), wallet);
    if (!me.isAdmin) throw new Error("Admin only.");
    const { generateOperatorKey, operatorAddressOf } = await import("@/lib/chain.server");
    const pk = await generateOperatorKey();
    await applyInfra(await getSql(), wallet, { operatorPk: pk });
    return { address: await operatorAddressOf(pk), rotated: true as const };
  });

export const fetchKycQueue = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(
    z.object({
      q: z.string().optional(),
      status: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { getMe } = await import("@/lib/engine.server");
    const sql = await getSql();
    const me = await getMe(sql, wallet);
    if (!me.isAdmin) throw new Error("Admin only.");
    const { listKyc } = await import("@/lib/kyc-store.server");
    return listKyc(sql, data);
  });

export const fetchKycDetail = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(z.object({ kycRef: z.string() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { getMe } = await import("@/lib/engine.server");
    const sql = await getSql();
    const me = await getMe(sql, wallet);
    if (!me.isAdmin) throw new Error("Admin only.");
    const { kycDetail } = await import("@/lib/kyc-store.server");
    return kycDetail(sql, wallet, data.kycRef);
  });

export const fetchKycPhoto = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(z.object({ kycRef: z.string().min(8).max(80) }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { getMe } = await import("@/lib/engine.server");
    const sql = await getSql();
    const me = await getMe(sql, wallet);
    if (!me.isAdmin) throw new Error("Admin only.");
    const { kycPhoto } = await import("@/lib/kyc-store.server");
    return kycPhoto(sql, wallet, data.kycRef);
  });

export const reviewKyc = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(
    z.object({
      kycRef: z.string(),
      approve: z.boolean(),
      reason: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { getMe } = await import("@/lib/engine.server");
    const sql = await getSql();
    const me = await getMe(sql, wallet);
    if (!me.isAdmin) throw new Error("Admin only.");
    const { reviewKyc: decide } = await import("@/lib/kyc-store.server");
    return decide(sql, wallet, data.kycRef, data.approve, data.reason ?? "");
  });

export const fetchPublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { publicConfig } = await import("@/lib/engine.server");
  return publicConfig();
});

export const setDevMode = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(z.object({ on: z.boolean() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { enableDevMode } = await import("@/lib/engine.server");
    return enableDevMode(await getSql(), wallet, data.on);
  });

export const dripFunds = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .handler(async ({ context }) => {
    const wallet = needWallet(context.wallet);
    const { dripDemo } = await import("@/lib/chain.server");
    const tx = await dripDemo(wallet as `0x${string}`);
    return { tx };
  });

export const prepareBuyer = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .handler(async ({ context }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { loadInfra } = await import("@/lib/infra.server");
    const { ensureNativeGas, demoStatus } = await import("@/lib/chain.server");
    let gasTx: string | null = null;
    let gasError: string | null = null;
    try {
      gasTx = (await ensureNativeGas(wallet as `0x${string}`)) ?? null;
    } catch (e) {
      gasError = e instanceof Error ? e.message : "Gas top-up failed";
    }
    const infra = await loadInfra(await getSql());
    let demo: { dripped: boolean; balance: string; cents: number } | null = null;
    if (infra.devMode && infra.demoBank) {
      try {
        demo = await demoStatus(infra.demoBank as `0x${string}`, wallet as `0x${string}`);
      } catch {
        demo = null;
      }
    }
    return {
      gasTx,
      gasError,
      demoBank: infra.demoBank || null,
      devMode: Boolean(infra.devMode),
      demo,
    };
  });

export const freezeShow = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(z.object({ eventId: z.coerce.number(), on: z.boolean() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { freezeEvent } = await import("@/lib/engine.server");
    return freezeEvent(await getSql(), wallet, data.eventId, data.on);
  });

export const fetchWithdrawals = createServerFn({ method: "GET" })
  .middleware([walletMiddleware])
  .handler(async ({ context }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { listWithdrawRequests } = await import("@/lib/engine.server");
    return listWithdrawRequests(await getSql(), wallet);
  });

export const decidePayout = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(z.object({ requestId: z.coerce.number(), approve: z.boolean() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { decideWithdraw } = await import("@/lib/engine.server");
    return decideWithdraw(await getSql(), wallet, data.requestId, data.approve);
  });

export const confirmVote = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(z.object({ ticketId: z.coerce.number(), txHash: z.string() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { confirmVote } = await import("@/lib/engine.server");
    return confirmVote(await getSql(), wallet, data.ticketId, data.txHash);
  });

export const escalatePayout = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(z.object({ eventId: z.coerce.number(), materialsUri: z.string() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { escalateWithdraw } = await import("@/lib/engine.server");
    return escalateWithdraw(await getSql(), wallet, data.eventId, data.materialsUri);
  });

export const executePayout = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(z.object({ eventId: z.coerce.number() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { executeGovWithdraw } = await import("@/lib/engine.server");
    return executeGovWithdraw(await getSql(), wallet, data.eventId);
  });

export const fetchSignerOps = createServerFn({ method: "GET" })
  .middleware([walletMiddleware])
  .handler(async ({ context }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { adminSignerOps } = await import("@/lib/engine.server");
    return adminSignerOps(await getSql(), wallet);
  });

export const fetchPendingIndex = createServerFn({ method: "GET" })
  .middleware([walletMiddleware])
  .handler(async ({ context }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { listPendingIndex } = await import("@/lib/engine.server");
    return listPendingIndex(await getSql(), wallet);
  });

export const retryPendingIndex = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(z.object({ id: z.coerce.number() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { replayPendingIndex } = await import("@/lib/engine.server");
    return replayPendingIndex(await getSql(), wallet, data.id);
  });

export const dismissPendingIndex = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(z.object({ id: z.coerce.number() }))
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { dismissPendingIndex } = await import("@/lib/engine.server");
    return dismissPendingIndex(await getSql(), wallet, data.id);
  });

export const uploadPoster = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(
    z.object({
      filename: z.string(),
      contentType: z.string(),
      base64: z.string(),
    }),
  )
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { getMe } = await import("@/lib/engine.server");
    const me = await getMe(await getSql(), wallet);
    if (!me.isOrganizer && !me.isAdmin) throw new Error("Organizers only.");
    const { pinFile } = await import("@/lib/pinata.server");
    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.length > 4_000_000) throw new Error("Image must be under 4MB.");
    return pinFile({ filename: data.filename, contentType: data.contentType, bytes });
  });

export const fetchAdminEvents = createServerFn({ method: "GET" })
  .middleware([walletMiddleware])
  .handler(async ({ context }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { adminAllEvents, getMe } = await import("@/lib/engine.server");
    const me = await getMe(await getSql(), wallet);
    if (!me.isAdmin) throw new Error("Admin only.");
    return adminAllEvents(await getSql());
  });

export const savePlatform = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .validator(
    z.object({
      adminWallet: z.string().optional(),
      chainName: z.string().optional(),
      nativeSymbol: z.string().optional(),
      rpcUrl: z.string().optional(),
      chainId: z.coerce.number().optional(),
      explorerUrl: z.string().optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { savePlatformFile } = await import("@/lib/engine.server");
    return savePlatformFile(await getSql(), wallet, data);
  });

export const claimPlatformAdmin = createServerFn({ method: "POST" })
  .middleware([walletMiddleware])
  .handler(async ({ context }) => {
    const wallet = needWallet(context.wallet);
    const { getSql } = await import("@/lib/db");
    const { setPlatformAdmin } = await import("@/lib/engine.server");
    return setPlatformAdmin(await getSql(), wallet, wallet);
  });
