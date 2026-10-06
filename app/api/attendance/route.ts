import { apiError, requireMember } from "../../../lib/api-auth";
import { adminSupabase, broadcastGymChange, rowToAttendance, unwrap } from "../../../lib/supabase";

function now() { return { date: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()), time: new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(new Date()) }; }
export async function GET(request: Request) {
  try {
    const memberId = Number(new URL(request.url).searchParams.get("memberId"));
    await requireMember(request, memberId);
    const db = adminSupabase();
    await db.rpc("fitnstop_auto_checkout");
    const rows = unwrap(await db.from("attendances").select("*").eq("member_id", memberId).order("entry_date", { ascending: false }).limit(100));
    const visits = rows.map(rowToAttendance);
    const validDurations = visits.filter((visit) => visit.exitMethod === "qr" && visit.durationMinutes !== null && visit.durationMinutes <= 150).map((visit) => visit.durationMinutes as number);
    return Response.json({ attendance: visits.find((visit) => visit.date === now().date) || null, visits, averageDurationMinutes: validDurations.length ? Math.round(validDurations.reduce((sum, value) => sum + value, 0) / validDurations.length) : null });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const { memberId, qrValue } = await request.json() as { memberId?: number; qrValue?: string };
    if (!memberId) throw new Error("Üye bilgisi eksik.");
    const authorizedMember = await requireMember(request, memberId);
    const db = adminSupabase(), current = now();
    if (authorizedMember.freezeStartDate && authorizedMember.frozenUntil && current.date >= authorizedMember.freezeStartDate && current.date < authorizedMember.frozenUntil) throw new Error("Üyeliğin bugün dondurulmuş durumda.");
    const settings = unwrap(await db.from("gym_settings").select("entrance_qr_token,exit_qr_token").eq("id", 1).single());
    const isExit = !!settings.exit_qr_token && qrValue === `FITNSTOP-CIKIS:${settings.exit_qr_token}`;
    if (isExit) {
      const existing = unwrap(await db.from("attendances").select("*").eq("member_id", memberId).eq("entry_date", current.date).maybeSingle());
      if (!existing) throw new Error("Bugün için salon girişi bulunamadı.");
      if (existing.exit_time) return Response.json({ attendance: rowToAttendance(existing), alreadyExited: true });
      const row = unwrap(await db.from("attendances").update({ exit_time: new Date().toISOString(), exit_method: "qr" }).eq("id", existing.id).is("exit_time", null).select().single());
      await broadcastGymChange("attendances", current.date);
      return Response.json({ attendance: rowToAttendance(row), alreadyExited: false });
    }
    if (!settings.entrance_qr_token || qrValue !== `FITNSTOP-GIRIS:${settings.entrance_qr_token}`) {
      await db.from("qr_scan_events").insert({ member_id: memberId, event_date: current.date, event_type: "invalid", message: "Geçersiz QR kodu okutuldu" });
      await broadcastGymChange("qr_scan_events", current.date);
      throw new Error("QR kodu geçersiz. Salondaki güncel giriş veya çıkış kodunu okutun.");
    }
    const reservation = unwrap(await db.from("reservations").select("*").eq("member_id", memberId).eq("reservation_date", current.date).maybeSingle());
    if (!reservation) throw new Error("Bugün için randevu bulunamadı.");
    const existing = unwrap(await db.from("attendances").select("*").eq("member_id", memberId).eq("entry_date", current.date).maybeSingle());
    if (existing) return Response.json({ attendance: rowToAttendance(existing), alreadyEntered: true });
    const row = unwrap(await db.from("attendances").insert({ member_id: memberId, reservation_id: reservation.id, entry_date: current.date, entry_time: new Date().toISOString(), reserved_time_slot: reservation.time_slot }).select().single());
    await broadcastGymChange("attendances", current.date);
    return Response.json({ attendance: rowToAttendance(row), alreadyEntered: false });
  } catch (error) { return apiError(error); }
}
