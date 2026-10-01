import { apiError, requireMember } from "../../../lib/api-auth";
import { adminSupabase, broadcastGymChange, rowToAttendance, unwrap } from "../../../lib/supabase";

function now() { return { date: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()), time: new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(new Date()) }; }
export async function GET(request: Request) {
  try {
    const memberId = Number(new URL(request.url).searchParams.get("memberId"));
    await requireMember(request, memberId);
    const row = unwrap(await adminSupabase().from("attendances").select("*").eq("member_id", memberId).eq("entry_date", now().date).maybeSingle());
    return Response.json({ attendance: row ? rowToAttendance(row) : null });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const { memberId, qrValue } = await request.json() as { memberId?: number; qrValue?: string };
    if (!memberId) throw new Error("Üye bilgisi eksik.");
    await requireMember(request, memberId);
    const db = adminSupabase(), current = now();
    const settings = unwrap(await db.from("gym_settings").select("entrance_qr_token").eq("id", 1).single());
    if (!settings.entrance_qr_token || qrValue !== `FITNSTOP-GIRIS:${settings.entrance_qr_token}`) throw new Error("Giriş QR kodu geçersiz. Salondaki güncel kodu okutun.");
    const reservation = unwrap(await db.from("reservations").select("*").eq("member_id", memberId).eq("reservation_date", current.date).maybeSingle());
    if (!reservation) throw new Error("Bugün için randevu bulunamadı.");
    const existing = unwrap(await db.from("attendances").select("*").eq("member_id", memberId).eq("entry_date", current.date).maybeSingle());
    if (existing) return Response.json({ attendance: rowToAttendance(existing), alreadyEntered: true });
    const row = unwrap(await db.from("attendances").insert({ member_id: memberId, reservation_id: reservation.id, entry_date: current.date, entry_time: new Date().toISOString(), reserved_time_slot: reservation.time_slot }).select().single());
    await broadcastGymChange("attendances", current.date);
    return Response.json({ attendance: rowToAttendance(row), alreadyEntered: false });
  } catch (error) { return apiError(error); }
}
