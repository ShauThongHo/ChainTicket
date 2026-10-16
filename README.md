# ChainTicket

A blockchain ticketing application for discovering events, issuing and trading ERC-721 tickets, and managing event entry and payouts on Gnosis Chiado or Gnosis mainnet.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Networks: Gnosis](https://img.shields.io/badge/networks-Chiado%20%7C%20Gnosis-blue)

> **Production caution.** ChainTicket handles on-chain transactions and sensitive KYC information. Review contracts, infrastructure and operational security before using it with real users.

## Features

- Browse events, inspect ticket tiers, and purchase tickets with a connected wallet.
- Issue, hold, and resell ERC-721 tickets.
- Submit KYC information for administrator review.
- Let organizers create events, scan ticket QR codes, manage refunds, and request payouts.
- Let administrators review organizers and KYC, configure the platform, freeze events, and review escalated payouts.
- Apply payout rules based on the deployed event contract version.

## Technology

- React 19, TypeScript, TanStack Start and TanStack Router
- Vite and Tailwind CSS
- Solidity, viem and OpenZeppelin Contracts
- PostgreSQL (including Neon deployments) and PGlite for local development
- Pinata for ticket metadata storage

## Project structure

```text
.
├── config/
│   ├── platform.example.json        # Chiado bootstrap template
│   └── platform.gnosis.example.json # Gnosis mainnet bootstrap template
├── contracts/                 # Solidity contracts and compiled artifacts
├── migrations/                # Database schema migrations
├── public/                    # Static assets, event artwork and icons
├── scripts/                   # Development, migration, contract and QA scripts
├── server/                    # Server middleware and deployment integration
├── src/
│   ├── components/            # Shared application and UI components
│   ├── lib/                   # API, database, wallet, chain, KYC and domain logic
│   └── routes/                # Marketplace, event, ticket, organizer and admin pages
├── package.json               # Dependencies and npm commands
├── package-lock.json          # Reproducible npm dependency lockfile
├── startup.sh                 # Workspace preview startup script
├── tsconfig.json              # TypeScript configuration
└── vite.config.ts             # Vite, TanStack Start and deployment configuration
```

Each deployment and database is bound to one network. Chiado uses chain ID `10200`; Gnosis mainnet uses chain ID `100`. The Admin configuration checks the RPC's actual chain ID before writes and prevents changing the network after events exist in that database. Use a separate deployment and database for each network.

## Requirements

- Node.js 22 or later
- npm
- A browser wallet configured for the selected network
- A Gnosis Chiado or Gnosis mainnet RPC endpoint

Database, operator signer, Pinata and KYC encryption configuration are required for the corresponding server-backed workflows.

## Initialize and run

Clone the repository, create the local platform configuration from the tracked example, and set the administrator wallet address before starting the app:

```bash
git clone https://github.com/ShauThongHo/ChainTicket.git
cd ChainTicket
cp config/platform.example.json config/platform.json
```

Edit `config/platform.json` and set `adminWallet` to the platform administrator's public wallet address. For Chiado, keep the default `platform.example.json` values. For Gnosis mainnet, copy `config/platform.gnosis.example.json` instead and use chain ID `100`. The file is intentionally ignored by Git because it is machine-specific. Use a distinct production deployment and database for mainnet.

Then install dependencies and start the development server:

```bash
npm ci
npm run dev
```

Open the local URL printed by the development server and connect a wallet configured for the selected network. Do not put private keys or service credentials in `config/platform.json`.

## Configuration

`config/platform.example.json` and `config/platform.gnosis.example.json` document the Chiado and mainnet bootstrap configuration shapes:

| Field | Purpose | Example / handling |
| --- | --- | --- |
| `adminWallet` | Public wallet address used to identify the platform administrator | Set this before first run; use an address, never a private key |
| `chainName` | Display name for the network | `Gnosis Chiado` or `Gnosis` |
| `nativeSymbol` | Network's native currency symbol | `XDAI` (Chiado) or `xDAI` (Gnosis) |
| `chainId` | Chain identifier | `10200` (Chiado) or `100` (Gnosis) |
| `rpcUrl` | JSON-RPC endpoint | Chiado or Gnosis RPC URL from the example |
| `explorerUrl` | Block explorer base URL | Chiado Blockscout or `https://gnosisscan.io` |

Database, operator signer, Pinata JWT and KYC encryption settings are separate server-side configuration. Configure them through the protected Admin Configuration flow or the deployment environment as appropriate. `DATABASE_URL` may be provided by the deployment environment. Never commit private keys, access tokens, database credentials, KYC keys, local KYC data, or secret files. On Gnosis mainnet, Dev mode, test DxDAI and KYC auto-approval are disabled. Pinata metadata and images are verified through the public gateway before contracts are deployed; the tier URI and first minted token's `tokenURI` are also read back before mint success is reported.

## Usage

1. Start the app and connect a wallet on the deployment's configured network.
2. Browse the marketplace and open an event to review its details and ticket tiers.
3. Complete KYC if the event requires it, then purchase a ticket.
4. View owned tickets under **My Tickets** and follow the on-screen instructions to present entry credentials.
5. Once approved, organizers can create events, scan tickets, and request payouts from the organizer area.
6. Administrators can configure services and review KYC, organizers and payout requests in the admin area.

Compile the Solidity contracts and refresh the checked-in ABI and bytecode artifacts with:

```bash
node scripts/compile-contracts.mjs
```

## Development

```bash
npm run dev          # Start the development server
npm run build        # Build the app and apply database migrations
npm run typecheck    # Run TypeScript checks
npm test             # Run automated tests
npm run lint         # Run ESLint
npm run db:migrate   # Apply database migrations
```

New events use engine version 4. Existing events retain their deployed contract version and payout behavior; deployed contracts are immutable. Version 4 payout requests open a seven-day opposition period after the event ends.

## Contributing

Issues and pull requests are welcome. Please explain the motivation and scope of changes, keep secrets and personal data out of commits, and include relevant test or verification results.

## License

ChainTicket is intended to be distributed under the MIT License. See [LICENSE](LICENSE) for the license text.
