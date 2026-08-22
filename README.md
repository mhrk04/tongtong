# TongTong

TongTong is a devnet-only Solana dApp for itemizing a shared SEA bill in local currency and settling each person’s exact share in USDC.

## Getting started

```shell
npm install
npm run dev
```

Open http://localhost:3000, connect the host wallet, and use devnet USDC. You need devnet SOL for transaction fees and devnet USDC in the connected wallet.

## Demo flow

1. Add manual receipt items and assign each item to one or more friends.
2. Choose the fixed demo FX rate and visible conversion fee.
3. Create the bill and copy a participant link or show its QR code.
4. Open the participant link in another browser tab, connect the paying wallet, and approve the exact USDC share.
5. TongTong verifies the confirmed devnet transaction’s recipient, mint, amount, and unique payment memo before marking the participant paid.
6. Watch the host bill screen update its pending/paid status.

## Scope limits

The bill store is intentionally in memory for the demo; keep the dev server running while testing a shared link. OCR, live FX feeds, fiat on/off-ramps, custody, mainnet money, authentication and custom programs are excluded from the hackathon MVP.
