import { getBill } from "../../../lib/bill-store";
import {
  NO_STORE_HEADERS,
  jsonError,
  routeErrorResponse,
} from "../../../lib/api-response";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ billId: string }> }
) {
  const { billId } = await params;
  try {
    const bill = await getBill(billId);
    if (!bill) return jsonError("Bill not found", 404, NO_STORE_HEADERS);
    return Response.json({ bill }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return routeErrorResponse(error, "Bill storage failed", 500);
  }
}
