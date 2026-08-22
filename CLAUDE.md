# TongTong

TongTong is a devnet-only Solana dApp for SEA friends splitting a multi-currency bill.

## MVP

- Manual MYR receipt total and equal split
- Fixed FX quote with visible conversion fee
- USDC devnet SPL transfer through `@solana/kit`
- Explorer link proving settlement

## Guardrails

- Keep the app devnet-only.
- Do not add custody, fiat ramps, live FX, OCR, or a custom program for the hackathon MVP.
- Reuse the generated Solana Kit client and token plugin.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
```
