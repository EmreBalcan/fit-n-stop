import { apiError, requireAdmin, requireMember } from "../../../lib/api-auth";
import { adminSupabase, broadcastGymChange, rowToReservation, unwrap } from "../../../lib/supabase";

const SLOTS = ["06.00 – 08.00", "08.00 – 10.00", "10.00 – 12.00", "12.00 – 14.00", "14.00 – 16.00", "16.00 – 18.00", "18.00 – 20.00", "20.00 – 22.00"];
const CAPACITY = 25;
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date);
function now() { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()); const get = (type: string) => parts.find((p) => p.type === type)?.value || ""; return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) }; }
function slotEnd(slot: string) { const m = slot.match(/–\s*(\d{2})\.(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : -1; }

export async function GET(request: Request) {
  try {
    const url = new URL(request.url), date = url.searchParams.get("date") || now().date, memberId = Number(url.searchParams.get("memberId"));
    if (!validDate(date)) throw new Error("Geçerli bir tarih seçin.");
    if (memberId) await requireMember(request, memberId); else requireAdmin(request);
    const db = adminSupabase();
    const [bookings, closure, settings] = await Promise.all([db.from("reservations").select("*, members(full_name, phone, email, tc_no)").eq("reservation_date", date).order("time_slot"), db.from("closed_days").select("*").eq("closed_date", date).maybeSingle(), db.from("gym_settings").select("capacity").eq("id", 1).single()]);
    const rows = unwrap(bookings).map((r) => ({ ...rowToReservation(r), fullName: r.members?.full_name, phone: r.members?.phone, email: r.members?.email, tcLast4: r.members?.tc_no?.slice(-4) }));
    const counts = Object.fromEntries(SLOTS.map((slot) => [slot, rows.filter((r) => r.timeSlot === slot).length]));
    const closed = unwrap(closure);
    return Response.json({ date, capacity: unwrap(settings).capacity || CAPACITY, slots: SLOTS, counts, reservation: memberId ? rows.find((r) => r.memberId === memberId) || null : null, reservations: memberId ? [] : rows, closedDay: closed ? { date: closed.closed_date, reason: closed.reason } : null });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const { memberId, date, timeSlot } = await request.json() as { memberId?: number; date?: string; timeSlot?: string };
    if (!memberId || !date || !validDate(date) || !timeSlot || !SLOTS.includes(timeSlot)) throw new Error("Randevu bilgileri geçersiz.");
    await requireMember(request, memberId);
    const current = now();
    if (date < current.date || date === current.date && slotEnd(timeSlot) <= current.minutes) throw new Error("Geçmiş seansa randevu alınamaz.");
    const db = adminSupabase();
    const closed = unwrap(await db.from("closed_days").select("*").eq("closed_date", date).maybeSingle());
    if (closed) throw new Error(closed.reason || "Salon kapalı.");
    const member = unwrap(await db.from("members").select("*").eq("id", memberId).single());
    if (member.status !== "active" || date < member.start_date || date > member.end_date) throw new Error("Seçilen tarih aktif üyelik süresinin dışında.");
    const existing = unwrap(await db.from("reservations").select("*").eq("member_id", memberId).eq("reservation_date", date).maybeSingle());
    if (existing && (existing.reservation_date < current.date || existing.reservation_date === current.date && slotEnd(existing.time_slot) <= current.minutes)) throw new Error("Süresi geçmiş randevu değiştirilemez.");
    const { count: occupancy, error: countError } = await db.from("reservations").select("id", { count: "exact", head: true }).eq("reservation_date", date).eq("time_slot", timeSlot);
    if (countError) throw countError;
    const capacity = unwrap(await db.from("gym_settings").select("capacity").eq("id", 1).single()).capacity || CAPACITY;
    if ((!existing || existing.time_slot !== timeSlot) && (occupancy || 0) >= capacity) return Response.json({ error: "Bu seans dolu." }, { status: 409 });
    const row = existing
      ? unwrap(await db.from("reservations").update({ time_slot: timeSlot }).eq("id", existing.id).select().single())
      : unwrap(await db.from("reservations").insert({ member_id: memberId, reservation_date: date, time_slot: timeSlot, created_at: new Date().toISOString() }).select().single());
    await broadcastGymChange("reservations", date);
    return Response.json({ reservation: rowToReservation(row) });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url), memberId = Number(url.searchParams.get("memberId")), date = url.searchParams.get("date") || "";
    if (!memberId || !validDate(date)) throw new Error("Randevu bilgileri eksik.");
    await requireMember(request, memberId);
    const db = adminSupabase(), current = now();
    const existing = unwrap(await db.from("reservations").select("id,time_slot").eq("member_id", memberId).eq("reservation_date", date).maybeSingle());
    if (!existing) throw new Error("Randevu bulunamadı.");
    if (date < current.date || date === current.date && slotEnd(existing.time_slot) <= current.minutes) throw new Error("Süresi geçmiş randevu iptal edilemez.");
    unwrap(await db.from("reservations").delete().eq("id", existing.id));
    await broadcastGymChange("reservations", date);
    return Response.json({ success: true });
  } catch (error) { return apiError(error); }
}
