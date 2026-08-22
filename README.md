# TongTong

TongTong is a devnet-only Solana dApp for itemizing a shared SEA bill in local currency and settling each person’s exact share in USDC.

## Getting started

Requires Node.js 24+ and a Wallet Standard-compatible Solana wallet.

```shell
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 and switch the wallet to devnet. The app uses the devnet USDC mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. The payer wallet needs devnet SOL for fees and devnet USDC for the share; the host wallet only needs to connect to create the bill.

## Test the payment flow

1. Connect the host wallet and create a bill with at least two people and one assigned item per person.
2. Copy a participant link or open its QR code. The QR contains the TongTong participant URL.
3. Open that link in a separate tab or browser, connect the payer wallet, and click the exact USDC amount.
4. Approve the devnet transaction in the wallet. TongTong sends an SPL USDC transfer with a unique payment memo.
5. Wait for verification, then open the transaction receipt link or refresh the host status link to see the participant marked paid. The API verifies the recipient, mint, exact amount, and payment memo before updating the bill.

Run the local checks with:

```shell
npm run typecheck
npm run lint
npm run build -- --webpack
npm test
```

This MVP does not use Redis. Local development stores bills in temporary in-memory storage, so restarting the dev server clears them. Deployed Vercel instances use Vercel Blob through `BLOB_READ_WRITE_TOKEN` so shared bill links work across serverless requests.

This MVP also does not implement Solana Pay payment requests. It uses Wallet Standard and `@solana/kit` to build and sign the USDC transfer; `solana:devnet` is the wallet chain identifier, not a Solana Pay URL.

## Vercel deployment

Create a Vercel Blob store from the project’s Storage tab and connect it to this project. Vercel will add `BLOB_READ_WRITE_TOKEN` to the selected environments automatically. Blob is free on the Hobby plan within its included limits.

## Scope limits

OCR, live FX feeds, fiat on/off-ramps, custody, mainnet money, authentication and custom programs are excluded from the hackathon MVP.
