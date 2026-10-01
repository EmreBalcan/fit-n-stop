import { apiError, requireAdmin } from "../../../lib/api-auth";
import { adminSupabase, broadcastGymChange, unwrap } from "../../../lib/supabase";

export async function GET(request: Request) { try { requireAdmin(request); const rows = unwrap(await adminSupabase().from("closed_days").select("*").order("closed_date")); return Response.json({ closedDays: rows.map((row) => ({ date: row.closed_date, reason: row.reason })) }); } catch (error) { return apiError(error); } }
export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const { date, reason } = await request.json() as { date?: string; reason?: string };
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Geçerli bir tarih seçin.");
    const db = adminSupabase();
    unwrap(await db.from("closed_days").upsert({ closed_date: date, reason: reason?.trim() || "Salon kapalı", created_at: new Date().toISOString() }));
    const cancelled = unwrap(await db.from("reservations").delete().eq("reservation_date", date).select("id"));
    if (cancelled.length) await broadcastGymChange("reservations", date);
    return Response.json({ success: true });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request) { try { requireAdmin(request); const date = new URL(request.url).searchParams.get("date"); if (date) unwrap(await adminSupabase().from("closed_days").delete().eq("closed_date", date)); return Response.json({ success: true }); } catch (error) { return apiError(error); } }
