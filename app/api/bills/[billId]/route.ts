import { getBill } from "../../../lib/bill-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ billId: string }> }
) {
  const { billId } = await params;
  const bill = getBill(billId);

  if (!bill) return Response.json({ error: "Bill not found" }, { status: 404 });
  return Response.json({ bill });
}
