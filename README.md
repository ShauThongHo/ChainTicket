# ChainTicket

ChainTicket is a blockchain ticketing application for the Gnosis Chiado test network. Attendees can discover events, purchase ERC-721 tickets, and present them at the door. Organizers can create events, check in ticket holders, and request payouts.

> This project is intended for test-network use. Review all on-chain, KYC, and payout settings carefully before deployment.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Network](https://img.shields.io/badge/network-Gnosis%20Chiado-blue)

## ✨ Features

- Browse events, view event details, and purchase tickets
- Hold event tickets as ERC-721 tokens
- Resell tickets and verify entry with ticket QR codes
- Submit KYC information for administrator review
- Create events, check in attendees, and manage refunds as an organizer
- Request and review payouts according to event rules
- Manage organizers, KYC, platform configuration, and event status as an administrator
- Perform on-chain operations on the Gnosis Chiado test network

## 🧰 Tech stack

- React 19, TypeScript, TanStack Start and TanStack Router
- Tailwind CSS and Vite
- Solidity, viem, and OpenZeppelin Contracts
- PostgreSQL (Neon) and PGlite

## 👥 Intended users

- Developers exploring blockchain ticketing workflows
- Event attendees and organizers using the Gnosis Chiado test network
- Platform administrators managing KYC, events, and payouts

## 🚀 Getting started

### Prerequisites

- Node.js 22
- npm
- A wallet configured for the Gnosis Chiado network

### Install and run

`ash
git clone https://github.com/ShauThongHo/ChainTicket.git
cd ChainTicket
npm install
npm run dev
`

Open the local address printed by the development server and connect a wallet configured for Gnosis Chiado.

## ⚙️ Configuration

On first run, open the administrator **Configuration** page to configure the database, Pinata, and operator signer. The bootstrap configuration includes the public administrator wallet address and RPC details. Sensitive credentials must be provided through protected administrator settings or the deployment environment.

| Setting | Purpose | Notes |
| --- | --- | --- |
| Database connection | Stores application data and configuration | Can be provided as DATABASE_URL in deployment environments |
| Chiado RPC URL | Connects to Gnosis Chiado | Use a reliable Chiado RPC provider |
| Operator signer key | Signs platform on-chain operations | Server-side secret; never commit it to the repository |
| Pinata JWT | Pins ticket metadata | Keep it private and server-side |
| KYC encryption key | Protects sensitive KYC data | Manage as a server-side secret |
| Administrator wallet address | Identifies the platform administrator | The address is public; do not confuse it with a private key |

> Never commit private keys, Pinata JWTs, KYC encryption keys, or database credentials to Git, and never post them in public issues. Disable Dev mode and KYC auto-approval in production.

## 📖 Basic usage

1. Start the app and connect a Gnosis Chiado wallet.
2. Browse events in the marketplace and review ticket and event details.
3. Complete KYC if required by an event, then purchase a ticket.
4. View owned tickets under **My Tickets** and follow the on-screen instructions to present entry credentials.
5. After approval by an administrator, organizers can create events, check in attendees, and request payouts under the applicable rules.

Administrators can configure platform services and review KYC, organizer, and payout requests in the admin area.

## 🧾 Smart contracts

Solidity sources are located in contracts/. To compile the contracts and refresh the checked-in ABI and bytecode artifacts, run:

`ash
node scripts/compile-contracts.mjs
`

New events use engine version 4. Existing events retain their deployed contract version and payout behavior. Deployed contracts are immutable.

## 💸 Payout rules

- Legacy events retain the original ticket-holder support vote.
- Version 4 events can request a payout only after the event ends. A seven-day opposition period follows, with voting weight based on tickets sold.
- If opposition reaches one third of the sold-ticket weight, the organizer can submit payout materials for administrator review after the period closes. Otherwise, the organizer can execute the payout after the full seven days.
- The app and server block cancellations and refunds after an event ends. Previously deployed contracts cannot be upgraded with this restriction.

## 🛠️ Troubleshooting

**Event creation fails**  
Check that the operator signer and Pinata JWT are configured in Admin Configuration. Metadata is pinned before tickets are minted.

**An on-chain transaction fails**  
Check the Chiado RPC, the operator account's native-token balance, and the wallet's selected network.

**A ticket image does not appear in a wallet**  
Third-party indexers may take time to refresh. Open the ticket metadata URL from the app to inspect the JSON and image URL directly.

**KYC stays pending**  
Confirm that the wallet completed the submission and that an administrator reviewed it. Auto-approval is available only in Dev mode.

**Payout is unavailable**  
The event must have ended. Version 4 events also require the seven-day opposition period to close.

## 🤝 Contributing

Issues and pull requests are welcome. Please describe the purpose and scope of your change and include relevant test or verification results.

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
