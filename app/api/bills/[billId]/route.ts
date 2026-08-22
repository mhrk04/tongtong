import { BillStoreError, getBill } from "../../../lib/bill-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ billId: string }> }
) {
  const { billId } = await params;
  try {
    const bill = await getBill(billId);
    if (!bill)
      return Response.json(
        { error: "Bill not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    return Response.json(
      { bill },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Bill storage failed",
      },
      { status: error instanceof BillStoreError ? 503 : 500 }
    );
  }
}
