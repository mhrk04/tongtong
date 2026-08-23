import {
  BillStoreError,
  getBill,
  isValidBillId,
} from "../../../lib/bill-store";

const noStore = { "Cache-Control": "no-store" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ billId: string }> }
) {
  const { billId } = await params;
  if (!isValidBillId(billId)) {
    return Response.json(
      { error: "Bill not found" },
      { status: 404, headers: noStore }
    );
  }
  try {
    const bill = await getBill(billId);
    if (!bill)
      return Response.json(
        { error: "Bill not found" },
        { status: 404, headers: noStore }
      );
    return Response.json({ bill }, { headers: noStore });
  } catch (error) {
    if (error instanceof BillStoreError) {
      return Response.json(
        { error: error.message },
        { status: 503, headers: noStore }
      );
    }
    console.error("Bill lookup failed", error);
    return Response.json(
      { error: "Bill storage failed" },
      { status: 500, headers: noStore }
    );
  }
}
