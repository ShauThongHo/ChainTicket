# ChainTicket

ChainTicket is a decentralized Web3 fair ticketing platform engineered for issuing, discovering, and trading bounded ERC-721 ticket passes, with anti-scalping identity verification, dynamic anti-screenshot entry gates, and escrowed vault governance on Gnosis Chiado and Gnosis mainnet.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Networks: Gnosis](https://img.shields.io/badge/networks-Chiado%20%7C%20Gnosis-blue)

> **Security & Operational Notice:** ChainTicket manages on-chain asset custody and encrypted KYC credentials. Always audit smart contracts, network RPCs, and environment isolation before deploying to production with real capital.

---

## Core Protocol Innovations

1. **Anti-Scalping 1-Wallet-1-Ticket Policy**
   - EVM smart contracts enforce strict single-ticket allowance per verified wallet (`require(held[buyer] == 0)`).
   - Lightweight identity verification blocks automated bot syndicates and multi-wallet hoarding.
2. **Fair Secondary Resale Pool (90%~110% Price Cap)**
   - Secondary ticket listings are cryptographically capped within ±10% of primary face value.
   - Eliminates predatory ticket scalping while preserving liquidity for fans who cannot attend.
   - Organizers automatically receive on-chain creator royalties on every secondary transfer.
3. **Dynamic Anti-Screenshot QR Turnstile**
   - Rotating entry codes are cryptographically generated using HMAC-SHA256 and refresh dynamically.
   - Gate passes remain locked until 2 hours before showtime to prevent static screenshot sharing.
   - Real-time mobile/web camera scanner decodes barcodes and verifies on-chain ownership instantly.
4. **EventVault Governance & Escrowed Payouts**
   - All ticket sales and secondary royalties are held in per-event `EventVault.sol` contracts until the show concludes.
   - When the organizer requests payout, a **7-day holder objection window** opens:
     - **Objections < 33.3% (1/3)**: Vault funds unlock for direct withdrawal by the organizer.
     - **Objections ≥ 33.3%**: Automatic freeze triggered; the organizer must upload proof of performance (IPFS CID materials) for platform administrator arbitration.

---

## Technical Architecture

```text
  ┌─────────────────────────────────────────────────────────┐
  │                 React 19 Frontend Layer                 │
  │   Marketplace  ·  Ticket Vault  ·  Scanner  ·  Admin    │
  └───────────────┬─────────────────────────┬───────────────┘
                  │                         │
      Viem / Web3 Injected Wallet           │ TanStack Server Functions
                  │                         │
                  ▼                         ▼
  ┌──────────────────────────────┐   ┌──────────────────────────────┐
  │   Smart Contracts (Gnosis)   │   │     Secure Backend Layer     │
  │  · EventMarketplace.sol      │   │  · AES-256-GCM KYC Storage   │
  │  · EventVault.sol (Escrow)   │   │  · HMAC-SHA256 QR Generator  │
  │  · TicketCollection (ERC721) │   │  · Pinata IPFS Gateway       │
  │  · DemoBank.sol (DxDAI)      │   │  · PostgreSQL / Neon PGlite  │
  └──────────────────────────────┘   └──────────────────────────────┘
```

- **Frontend**: React 19, TypeScript, TanStack Start, TanStack Router, Tailwind CSS, Lucide Line Icons.
- **Web3 & Contracts**: Solidity `^0.8.28`, Viem `^2.23`, OpenZeppelin Contracts v5.
- **Backend & Server Functions**: TanStack Server Functions, Node.js 22 crypto runtime.
- **Database**: PostgreSQL (Neon serverless or local PGlite), schema migrations via node-pg.
- **Decentralized Storage**: Pinata IPFS gateway for event posters and ERC-721 token metadata.

---

## Project Structure

```text
.
├── config/
│   ├── platform.example.json        # Chiado bootstrap template
│   └── platform.gnosis.example.json # Gnosis mainnet bootstrap template
├── contracts/                       # Solidity smart contracts and compilation output
├── migrations/                      # PostgreSQL database schema migrations
├── public/                          # Static web assets, artwork, and branding
├── scripts/                         # Development, compilation, and smoke-test utilities
├── server/                          # Production server middleware
├── src/
│   ├── components/                  # UI components (AppShell, TxDialog, PhaseBadge, etc.)
│   ├── lib/                         # Core API, crypto, chain, wallet, and storage logic
│   └── routes/                      # Application route views (Market, Events, Tickets, Organizer, Admin)
├── package.json                     # Project manifest and scripts
├── tsconfig.json                    # TypeScript compiler options
└── vite.config.ts                   # Vite and TanStack Start bundler configuration
```

---

## KYC Privacy & Storage Architecture

ChainTicket implements a **Dual-Rail Privacy Architecture** for identity credentials:

- **Personal Information (Name, ID, Nationality)**: Encrypted using **AES-256-GCM** with a unique 12-byte initialization vector (IV) per record. Stored in an isolated private database table (`kyc_private`).
- **Sybil Resistance**: A salted **HMAC-SHA256** hash of the normalized ID is stored to prevent duplicate registrations without storing plaintext ID numbers.
- **Document Photos & Scans**:
  - Automatically stripped of all EXIF and GPS geolocation metadata upon upload.
  - Stored in a secure local filesystem directory (`.data/kyc-photos/`) with strict POSIX `0600` owner-only permissions.
  - Filenames use cryptographically random 32-character hexadecimal references (`kyc_ref`), leaving zero public traces to user wallet addresses.
  - No direct public HTTP access; all administrative reviews require authenticated sessions and log an audit trail (`kyc_audit`).
- **Rejection & Re-submission**: If a submission is rejected by an administrator, the rejection reason is displayed and the user can update and re-submit their credentials immediately.

---

## Security & Git Ignore Policy (.gitignore)

To guarantee that secrets, private credentials, and sensitive artifacts are **never uploaded to GitHub**, the repository enforces strict `.gitignore` rules:

```gitignore
# Local data and KYC documents (NEVER commit real user data)
.data/
.data/*

# Environment and sensitive keys
.env
.env.*
!.env.example
*.pem
*.key
*.pfx
*.p12
operator-secrets.json
config/platform.json
config/*secrets*
config/*private*
config/*credentials*
infra.json
secrets/

# Database files
*.sqlite
*.db
*.db-journal
*.db-wal

# AI Agents & Automation tool scratchpads
.agents/
.agents
AGENTS.md
AGENTS.*.md
.grok/
.grok

# Build outputs, logs, and artifacts
node_modules/
dist/
build/
.output/
.vercel/
.cache/
*.log
screenshots/
artifacts/
```

---

## Quickstart

### 1. Prerequisites
- Node.js `22.x` or later
- npm `10.x` or later
- A browser wallet (MetaMask, Rabby, Coinbase Wallet, etc.) configured for **Gnosis Chiado (10200)** or **Gnosis Mainnet (100)**

### 2. Installation & Setup
```bash
# 1. Clone repository
git clone https://github.com/ShauThongHo/ChainTicket.git
cd ChainTicket

# 2. Configure network bootstrap file
cp config/platform.example.json config/platform.json

# 3. Edit config/platform.json and set adminWallet to your public address
# (Never place private keys in config/platform.json)

# 4. Install dependencies
npm ci

# 5. Start development server
npm run dev
```

The application will be served at `http://localhost:8080`.

---

## Available Scripts

| Command | Action |
| --- | --- |
| `npm run dev` | Starts the Vite / TanStack Start development server |
| `npm run build` | Builds client/server production bundles and verifies migrations |
| `npm run typecheck` | Runs TypeScript static type analysis across the codebase |
| `npm test` | Runs the test suite |
| `npm run lint` | Lints source files with ESLint |
| `npm run db:migrate` | Executes SQL schema migrations against the connected PostgreSQL database |
| `node scripts/compile-contracts.mjs` | Recompiles Solidity contracts and generates fresh ABI artifacts in `src/lib/abi/` |

---

## License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for full terms.
