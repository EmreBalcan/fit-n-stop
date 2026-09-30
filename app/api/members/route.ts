import { requireAdmin, apiError } from "../../../lib/api-auth";
import { adminSupabase, authEmail, broadcastGymChange, rowToAttendance, rowToMember, rowToReservation, unwrap } from "../../../lib/supabase";

type Payload = { id?: number; fullName?: string; phone?: string; email?: string; startDate?: string; endDate?: string; status?: "active" | "frozen" | "cancelled"; notes?: string; tcNo?: string; password?: string };
function clean(raw: Payload) {
  const full_name = raw.fullName?.trim() || "", phone = raw.phone?.trim() || "", start_date = raw.startDate || "", end_date = raw.endDate || "";
  if (!full_name || !phone || !start_date || !end_date) throw new Error("Ad soyad, telefon ve üyelik tarihleri zorunludur.");
  if (end_date < start_date) throw new Error("Bitiş tarihi başlangıç tarihinden önce olamaz.");
  return { full_name, phone, email: raw.email?.trim() || null, start_date, end_date, status: raw.status === "cancelled" ? "expired" : raw.status || "active" };
}
function checkTc(tc?: string) { if (!/^\d{11}$/.test(tc || "")) throw new Error("TC kimlik numarası 11 haneli olmalıdır."); return tc!; }

export async function GET(request: Request) {
  try {
    requireAdmin(request);
    const db = adminSupabase();
    const [members, reservations, attendances, users] = await Promise.all([db.from("members").select("*").order("created_at", { ascending: false }), db.from("reservations").select("*").order("reservation_date"), db.from("attendances").select("*").order("entry_date", { ascending: false }), db.auth.admin.listUsers({ page: 1, perPage: 1000 })]);
    const rows = unwrap(members), bookings = unwrap(reservations).map(rowToReservation), visits = unwrap(attendances).map(rowToAttendance);
    if (users.error) throw users.error;
    const notes = new Map(users.data.users.map((user) => [user.id, user.user_metadata?.notes || ""]));
    return Response.json({ members: rows.map((row) => ({ ...rowToMember(row), notes: notes.get(row.auth_user_id) || "", reservations: bookings.filter((r) => r.memberId === row.id), attendances: visits.filter((v) => v.memberId === row.id), visitCount: visits.filter((v) => v.memberId === row.id).length })) });
  } catch (error) { return apiError(error, 500); }
}

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const raw = await request.json() as Payload, data = clean(raw), tc = checkTc(raw.tcNo);
    if ((raw.password?.length || 0) < 6) throw new Error("Geçici şifre en az 6 karakter olmalıdır.");
    const db = adminSupabase();
    const { data: auth, error: authError } = await db.auth.admin.createUser({ email: authEmail(tc), password: raw.password, email_confirm: true, user_metadata: { notes: raw.notes?.trim() || "" } });
    if (authError || !auth.user) throw new Error(authError?.message || "Giriş hesabı oluşturulamadı.");
    try {
      const now = new Date().toISOString();
      const row = unwrap(await db.from("members").insert({ ...data, auth_user_id: auth.user.id, tc_no: tc, must_change_password: true, freeze_used: false, created_at: now, updated_at: now }).select().single());
      await broadcastGymChange("members");
      return Response.json({ member: { ...rowToMember(row), notes: raw.notes?.trim() || "", reservations: [], attendances: [], visitCount: 0 } }, { status: 201 });
    } catch (error) { await db.auth.admin.deleteUser(auth.user.id); throw error; }
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request) {
  try {
    requireAdmin(request);
    const raw = await request.json() as Payload;
    if (!raw.id) throw new Error("Üye kimliği eksik.");
    const db = adminSupabase(), prior = unwrap(await db.from("members").select("*").eq("id", raw.id).single());
    const update: Record<string, unknown> = { ...clean(raw), updated_at: new Date().toISOString() };
    if (raw.tcNo) { const tc = checkTc(raw.tcNo); if (!prior.auth_user_id) throw new Error("Üyenin giriş hesabı bulunamadı."); const { error } = await db.auth.admin.updateUserById(prior.auth_user_id, { email: authEmail(tc), email_confirm: true }); if (error) throw error; update.tc_no = tc; }
    if (raw.password) { if (raw.password.length < 6) throw new Error("Geçici şifre en az 6 karakter olmalıdır."); if (!prior.auth_user_id) throw new Error("Üyenin giriş hesabı bulunamadı."); const { error } = await db.auth.admin.updateUserById(prior.auth_user_id, { password: raw.password }); if (error) throw error; update.must_change_password = true; }
    if (prior.auth_user_id) { const { error } = await db.auth.admin.updateUserById(prior.auth_user_id, { user_metadata: { notes: raw.notes?.trim() || "" } }); if (error) throw error; }
    const row = unwrap(await db.from("members").update(update).eq("id", raw.id).select().single());
    await broadcastGymChange("members");
    return Response.json({ member: { ...rowToMember(row), notes: raw.notes?.trim() || "", reservations: [], attendances: [], visitCount: 0 } });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    requireAdmin(request);
    const id = Number(new URL(request.url).searchParams.get("id")); if (!id) throw new Error("Üye kimliği eksik.");
    const db = adminSupabase(), row = unwrap(await db.from("members").select("*").eq("id", id).single());
    if (row.auth_user_id) { const { error } = await db.auth.admin.deleteUser(row.auth_user_id); if (error) throw error; }
    unwrap(await db.from("members").delete().eq("id", id));
    await broadcastGymChange("members");
    return Response.json({ success: true });
  } catch (error) { return apiError(error); }
}
