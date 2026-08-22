# TongTong

TongTong is a devnet-only Solana dApp for itemizing a shared SEA bill in local currency and settling each person’s exact share in USDC.

## Getting started

```shell
npm install
npm run dev
```

Open http://localhost:3000, connect the host wallet, and use devnet USDC. You need devnet SOL for transaction fees and devnet USDC in the connected wallet.

## Vercel deployment

Create a Vercel Blob store from the project’s Storage tab and connect it to this project. Vercel will add `BLOB_READ_WRITE_TOKEN` to the selected environments automatically. Blob is free on the Hobby plan within its included limits.

Vercel functions do not share an in-memory process, so Blob is required for a bill created by one request to be found by a friend’s payment-link request. Local development falls back to in-memory storage when the Blob variable is absent.

## Demo flow

1. Add manual receipt items and assign each item to one or more friends.
2. Choose the fixed demo FX rate and visible conversion fee.
3. Create the bill, keep the refresh-safe host link, and copy a participant link or show its QR code.
4. Open the participant link in another browser tab, connect the paying wallet, and approve the exact USDC share.
5. TongTong verifies the confirmed devnet transaction’s recipient, mint, amount, and unique payment memo before marking the participant paid.
6. Reopen `/bill/<billId>` any time to watch the host bill screen update its pending/paid status.

## Scope limits

OCR, live FX feeds, fiat on/off-ramps, custody, mainnet money, authentication and custom programs are excluded from the hackathon MVP.
