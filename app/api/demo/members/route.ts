import { apiError } from "../../../../lib/api-auth";
import { adminSupabase, rowToAttendance, rowToMember, rowToReservation, unwrap } from "../../../../lib/supabase";

export async function GET() {
  try {
    const db = adminSupabase();
    const users = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (users.error) throw users.error;
    const demoUsers = users.data.users.filter(user => String(user.user_metadata?.notes || "").includes("[DEMO]"));
    const demoIds = demoUsers.map(user => user.id);
    if (!demoIds.length) return Response.json({ members: [], qrEvents: [] }, { headers: { "cache-control": "no-store" } });
    const rows = unwrap(await db.from("members").select("*").in("auth_user_id", demoIds).order("created_at", { ascending: false }));
    const memberIds = rows.map(row => row.id);
    const notes = new Map(demoUsers.map(user => [user.id, String(user.user_metadata?.notes || "").replace("[DEMO]", "").trim()]));
    const [reservations, attendances, qrEvents] = memberIds.length ? await Promise.all([
      db.from("reservations").select("*").in("member_id", memberIds).order("reservation_date"),
      db.from("attendances").select("*").in("member_id", memberIds).order("entry_date", { ascending: false }),
      db.from("qr_scan_events").select("*, members(full_name)").in("member_id", memberIds).order("event_time", { ascending: false }).limit(200),
    ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
    const bookings = unwrap(reservations).map(rowToReservation), visits = unwrap(attendances).map(rowToAttendance);
    return Response.json({
      members: rows.map(row => ({ ...rowToMember(row), notes: notes.get(row.auth_user_id) || "", reservations: bookings.filter(r => r.memberId === row.id), attendances: visits.filter(v => v.memberId === row.id), visitCount: visits.filter(v => v.memberId === row.id).length })),
      qrEvents: unwrap(qrEvents).map((event:any) => ({ id: event.id, memberId: event.member_id, memberName: event.members?.full_name || "Demo üye", date: event.event_date, time: new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(new Date(event.event_time)), message: event.message })),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return apiError(error, 500); }
}
