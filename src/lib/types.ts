export type OrganizerStatus = "pending" | "approved" | "revoked";

export type TicketStatus = "vault" | "owned" | "listed" | "used" | "refunded";

export type EventPhase = "active" | "cancelled" | "ended";

export type KycStatus = "pending" | "approved" | "rejected" | "expired";

export type SessionMe = {
  address: string;
  isAdmin: boolean;
  isOrganizer: boolean;
  organizerName: string | null;
  kyc: {
    status: KycStatus;
    submittedAt: string;
    verifiedAt: string | null;
    idLast4: string | null;
    rejectReason: string | null;
    documentExpiresAt: string | null;
  } | null;
  spendableCents: number;
  faucetClaimed: boolean;
  role: "admin" | "organizer" | "attendee";
};

export type PublicConfig = {
  chainName: string;
  nativeSymbol: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  adminConfigured: boolean;
  devMode: boolean;
  demoBank: string | null;
  pinataReady: boolean;
  setupComplete: boolean;
};

export type EventListItem = {
  id: number;
  name: string;
  venue: string;
  category: string;
  posterUrl: string;
  startsAt: string;
  endsAt: string;
  cancelled: boolean;
  minCents: number | null;
  maxCents: number | null;
  available: number;
  sold: number;
  supply: number;
  phase: EventPhase;
  engineVersion: number;
  frozen: boolean;
  collectionAddress: string | null;
};

export type TierView = {
  id: number;
  name: string;
  faceCents: number;
  supply: number;
  available: number;
  minCents: number | null;
  maxCents: number | null;
  contractAddress: string;
};

export type EventDetail = {
  id: number;
  name: string;
  description: string;
  venue: string;
  category: string;
  posterUrl: string;
  startsAt: string;
  endsAt: string;
  cancelled: boolean;
  organizerWallet: string;
  organizerName: string | null;
  tiers: TierView[];
  royaltyBps: number;
  vaultAddress: string | null;
  marketplaceAddress: string | null;
  collectionAddress: string | null;
  deployTx: string | null;
  phase: EventPhase;
  engineVersion: number;
  frozen: boolean;
};

export type TicketProposal = {
  status: string;
  yesWeight: number;
  soldWeight: number;
  deadline: string | null;
  hasVoted: boolean;
};

export type MyTicket = {
  id: number;
  tokenId: string;
  serial: number;
  status: TicketStatus;
  faceCents: number;
  eventId: number;
  eventName: string;
  venue: string;
  posterUrl: string;
  startsAt: string;
  endsAt: string;
  cancelled: boolean;
  tierName: string;
  contractAddress: string;
  marketplaceAddress: string | null;
  collectionAddress: string | null;
  tokenUri: string | null;
  listPriceCents: number | null;
  chainId: number | null;
  phase: EventPhase;
  engineVersion: number;
  proposal: TicketProposal | null;
};

export type QrPayload = {
  locked: boolean;
  unlocksAt: string | null;
  reason?: string;
  payload?: string;
  expiresAt?: string;
};

export type OrganizerEvent = {
  id: number;
  name: string;
  venue: string;
  posterUrl: string;
  startsAt: string;
  endsAt: string;
  cancelled: boolean;
  lockedCents: number;
  withdrawn: boolean;
  sold: number;
  available: number;
  supply: number;
  checkedIn: number;
  checkInRate: number;
  vaultAddress: string | null;
  marketplaceAddress: string | null;
  collectionAddress: string | null;
  deployTx: string | null;
  phase: EventPhase;
  engineVersion: number;
  frozen: boolean;
  withdrawRequest: "pending" | "pending_vote" | "passed" | "escalated" | "rejected" | "done" | "approved" | null;
  proposalYes: number;
  proposalSold: number;
  proposalDeadline: string | null;
  materialsUri: string | null;
};

export type LedgerRow = {
  id: number;
  eventId?: number | null;
  kind: string;
  amountCents: number;
  ref: string;
  createdAt: string;
  eventName: string | null;
  onChain: boolean;
};

export type BuyQuote = {
  ticketId: number;
  chainId: number;
  marketplace: string;
  digest: string;
  priceCents: number;
  priceWei: string;
  payNative: boolean;
  eventName: string;
  tierName: string;
  dxdaiWei: string | null;
  marketPull: boolean | null;
};

export type InfraStatus = {
  db: {
    source: "neon" | "pglite";
    host: string;
    masked: string;
    envUrlSet: boolean;
    overrideSet: boolean;
    tables: { name: string; n: number }[];
    error: string | null;
    connected: boolean;
  };
  chain: {
    rpcUrl: string;
    chainId: number;
    chainName: string;
    nativeSymbol: string;
    connected: boolean;
    blockNumber: number | null;
    operatorAddress: string | null;
    operatorBalance: string | null;
    operatorKeySet: boolean;
    operatorMask: string | null;
    explorerUrl: string;
    lastError: string | null;
    lastAnchor: { hash: string; at: string; kind: string } | null;
    error: string | null;
    devMode: boolean;
    demoBank: string | null;
    pinataSet: boolean;
    pinataMask: string | null;
  };
  contracts: {
    id: number;
    kind: string;
    eventId: number | null;
    address: string;
    txHash: string;
    createdAt: string;
  }[];
  royaltyBps: number;
  adminCount: number;
  adminWallet: string;
  setup: {
    database: boolean;
    pinata: boolean;
    signer: boolean;
    complete: boolean;
  };
  kyc: {
    privateSource: "env" | "database" | "shared";
    privateHost: string;
    keySource: "env" | "database" | "missing";
    autoApprove: boolean;
  };
};

export type WithdrawRequest = {
  id: number;
  eventId: number;
  eventName: string;
  organizerWallet: string;
  amountCents: number;
  status: "pending" | "pending_vote" | "passed" | "escalated" | "rejected" | "done" | "approved";
  txHash: string | null;
  createdAt: string;
  yesWeight: number;
  soldWeight: number;
  deadline: string | null;
  materialsUri: string | null;
  engineVersion?: number;
};

export type KycListRow = {
  wallet: string;
  kycRef: string;
  status: KycStatus;
  submittedAt: string;
  verifiedAt: string | null;
  reviewedBy: string | null;
  rejectReason: string | null;
  documentExpiresAt: string | null;
};

export type KycDetail = KycListRow & {
  fullName: string;
  nationality: string;
  idNumber: string;
  idLast4: string | null;
  hasPhoto: boolean;
};

export type OrganizerRow = {
  wallet: string;
  name: string;
  status: OrganizerStatus;
  eventCount: number;
  createdAt: string;
};

export type PendingIndexRow = {
  id: number;
  kind: string;
  txHash: string;
  error: string | null;
  createdAt: string;
};
