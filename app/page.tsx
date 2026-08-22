"use client";

import { TongTongFlow } from "./components/tongtong-flow";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8 sm:py-12">
      <section className="mb-10 max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          TongTong · cross-border bill settlement
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-[-0.06em] sm:text-6xl">
          Split in MYR.
          <br />
          Settle in USDC.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-foreground/60 sm:text-lg">
          For SEA friends who share a bill across borders. TongTong shows each
          person a clear fee-inclusive quote, then settles the balance on
          Solana.
        </p>
      </section>
      <TongTongFlow />
    </main>
  );
}
