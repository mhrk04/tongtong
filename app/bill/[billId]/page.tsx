"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BillCreated } from "../../components/tongtong-flow";
import type { Bill } from "../../lib/bill-store";
import { errorMessage, fetchJson } from "../../lib/fetch-json";

export default function BillHostPage() {
  const params = useParams<{ billId: string }>();
  const router = useRouter();
  const [bill, setBill] = useState<Bill>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ bill: Bill }>(`/api/bills/${params.billId}`, {
      cache: "no-store",
    })
      .then((result) => {
        if (!cancelled) setBill(result.bill);
      })
      .catch((reason: unknown) => {
        console.error(reason);
        if (!cancelled) setError(errorMessage(reason, "Bill not found"));
      });
    return () => {
      cancelled = true;
    };
  }, [params.billId]);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-black">{error}</h1>
        <p className="mt-2 text-sm text-muted">
          Check the bill link or create a new shared bill.
        </p>
      </main>
    );
  }
  if (!bill) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center text-sm text-muted">
        Loading your shared bill...
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-16">
      <BillCreated bill={bill} onReset={() => router.push("/")} />
    </main>
  );
}
