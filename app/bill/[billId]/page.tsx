"use client";

import { useParams, useRouter } from "next/navigation";
import { BillCreated } from "../../components/tongtong-flow";
import { BillPageState } from "../../components/bill-page-state";
import { useBill } from "../../lib/bill-api";

export default function BillHostPage() {
  const params = useParams<{ billId: string }>();
  const router = useRouter();
  const { bill, error } = useBill(params.billId);

  if (error) {
    return (
      <BillPageState
        heading={error}
        description="Check the bill link or create a new shared bill."
      />
    );
  }
  if (!bill) {
    return <BillPageState description="Loading your shared bill..." />;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-16">
      <BillCreated bill={bill} onReset={() => router.push("/")} />
    </main>
  );
}
