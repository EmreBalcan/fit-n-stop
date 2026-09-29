import { getDb } from "../../../db";
import { members, reservations } from "../../../db/schema";

// One-time maintenance endpoint. Removed immediately after the requested reset.
export async function POST(request: Request) {
  if (request.headers.get("x-reset-key") !== "fnstop-2026-reset-9f31c7") return Response.json({ error: "Yetkisiz işlem." }, { status: 403 });
  await getDb().delete(reservations);
  await getDb().delete(members);
  return Response.json({ success: true });
}
