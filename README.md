# ChainTicket

A blockchain ticketing application for discovering events, issuing and trading ERC-721 tickets, and managing event entry and payouts on the Gnosis Chiado test network.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Network: Gnosis Chiado](https://img.shields.io/badge/network-Gnosis%20Chiado-blue)

> **Test-network software.** ChainTicket handles on-chain transactions and sensitive KYC information. Review its security and deployment settings before using it with real users.

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
│   └── platform.example.json  # Public platform bootstrap template
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

## Requirements

- Node.js 22 or later
- npm
- A browser wallet configured for Gnosis Chiado
- A Gnosis Chiado RPC endpoint for network access

Database, operator signer, Pinata and KYC encryption configuration are required for the corresponding server-backed workflows.

## Initialize and run

Clone the repository, create the local platform configuration from the tracked example, and set the administrator wallet address before starting the app:

```bash
git clone https://github.com/ShauThongHo/ChainTicket.git
cd ChainTicket
cp config/platform.example.json config/platform.json
```

Edit `config/platform.json` and set `adminWallet` to the platform administrator's public Chiado wallet address. The example already provides Chiado's chain ID, RPC URL and explorer URL; adjust them if you use a different network endpoint. The file is intentionally ignored by Git because it is machine-specific.

Then install dependencies and start the development server:

```bash
npm ci
npm run dev
```

Open the local URL printed by the development server and connect a wallet configured for Gnosis Chiado. Do not put private keys or service credentials in `config/platform.json`.

## Configuration

`config/platform.example.json` documents the bootstrap configuration shape:

| Field | Purpose | Example / handling |
| --- | --- | --- |
| `adminWallet` | Public wallet address used to identify the platform administrator | Set this before first run; use an address, never a private key |
| `chainName` | Display name for the network | `Testnet` in the example |
| `nativeSymbol` | Network's native currency symbol | `xDAI` in the example |
| `chainId` | Chain identifier | `10200` for Gnosis Chiado |
| `rpcUrl` | JSON-RPC endpoint | `https://rpc.chiadochain.net` in the example |
| `explorerUrl` | Block explorer base URL | `https://gnosis-chiado.blockscout.com` in the example |

Database, operator signer, Pinata JWT and KYC encryption settings are separate server-side configuration. Configure them through the protected Admin Configuration flow or the deployment environment as appropriate. `DATABASE_URL` may be provided by the deployment environment. Never commit private keys, access tokens, database credentials, KYC keys, local KYC data, or secret files. Dev mode and KYC auto-approval are for development only; keep auto-approval disabled in production.

## Usage

1. Start the app and connect a Gnosis Chiado wallet.
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
