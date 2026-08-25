"use client";

import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { WalletButton } from "./wallet-button";

export function AppHeader() {
  return (
    <header className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-6 py-4">
      <Link href="/" className="text-sm font-black tracking-tight">
        TongTong
      </Link>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <WalletButton />
      </div>
    </header>
  );
}
