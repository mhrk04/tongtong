"use client";

import { useParams } from "next/navigation";
import { BillPayment } from "../../../components/tongtong-flow";
import { BillPageState } from "../../../components/bill-page-state";
import { useBill } from "../../../lib/bill-api";

export default function BillParticipantPage() {
  const params = useParams<{ billId: string; participantId: string }>();
  const { bill, error } = useBill(params.billId);

  if (error) {
    return (
      <BillPageState
        heading={error}
        description="The demo server may have restarted."
      />
    );
  }
  if (!bill) {
    return <BillPageState description="Loading your share..." />;
  }

  const participant = bill.participants.find(
    (candidate) => candidate.id === params.participantId
  );
  if (!participant) {
    return <BillPageState heading="Participant not found" />;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 sm:py-16">
      <BillPayment bill={bill} participant={participant} />
    </main>
  );
}
