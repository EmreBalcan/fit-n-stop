import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { attendances, members, reservations } from "../../../db/schema";
import { hashPassword, hashTc } from "../../../lib/member-security";

type MemberPayload = {
  id?: number; fullName?: string; phone?: string; email?: string;
  startDate?: string; endDate?: string;
  status?: "active" | "frozen" | "cancelled"; notes?: string; tcNo?: string; password?: string;
};

function message(error: unknown) {
  const text = error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
  if (text.includes("no such table")) return "Üye veritabanı henüz hazır değil.";
  return text;
}

function clean(payload: MemberPayload) {
  const fullName = payload.fullName?.trim() ?? "";
  const phone = payload.phone?.trim() ?? "";
  const startDate = payload.startDate ?? "";
  const endDate = payload.endDate ?? "";
  if (!fullName || !phone || !startDate || !endDate) throw new Error("Ad soyad, telefon ve üyelik tarihleri zorunludur.");
  if (endDate < startDate) throw new Error("Bitiş tarihi başlangıç tarihinden önce olamaz.");
  return { fullName, phone, email: payload.email?.trim() || null, startDate, endDate, status: payload.status ?? ("active" as const), notes: payload.notes?.trim() ?? "" };
}

export async function GET() {
  try {
    const rows = await getDb().select().from(members).orderBy(desc(members.createdAt));
    const bookings = await getDb().select().from(reservations).orderBy(asc(reservations.date), asc(reservations.timeSlot));
    const visits = await getDb().select().from(attendances).orderBy(desc(attendances.checkedInAt));
    return Response.json({ members: rows.map(({ passwordHash, passwordSalt, tcHash, ...row }) => ({ ...row, hasPassword: !!passwordHash, reservations: bookings.filter((booking) => booking.memberId === row.id), attendances: visits.filter((visit) => visit.memberId === row.id), visitCount: visits.filter((visit) => visit.memberId === row.id).length })) });
  } catch (error) { return Response.json({ error: message(error) }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const raw = (await request.json()) as MemberPayload;
    const payload = clean(raw);
    if (!/^\d{11}$/.test(raw.tcNo ?? "")) throw new Error("TC kimlik numarası 11 haneli olmalıdır.");
    if ((raw.password?.length ?? 0) < 6) throw new Error("Geçici şifre en az 6 karakter olmalıdır.");
    const credentials = await hashPassword(raw.password!);
    const now = new Date().toISOString();
    const [member] = await getDb().insert(members).values({ ...payload, tcHash: await hashTc(raw.tcNo!), tcLast4: raw.tcNo!.slice(-4), passwordHash: credentials.hash, passwordSalt: credentials.salt, mustChangePassword: true, createdAt: now, updatedAt: now }).returning();
    const { passwordHash, passwordSalt, tcHash, ...safeMember } = member;
    return Response.json({ member: { ...safeMember, hasPassword: !!passwordHash } }, { status: 201 });
  } catch (error) { return Response.json({ error: message(error) }, { status: 400 }); }
}

export async function PUT(request: Request) {
  try {
    const raw = (await request.json()) as MemberPayload;
    if (!raw.id) throw new Error("Üye kimliği eksik.");
    const payload = clean(raw);
    const credentialUpdate: Record<string, unknown> = {};
    if (raw.tcNo) { if (!/^\d{11}$/.test(raw.tcNo)) throw new Error("TC kimlik numarası 11 haneli olmalıdır."); credentialUpdate.tcHash = await hashTc(raw.tcNo); credentialUpdate.tcLast4 = raw.tcNo.slice(-4); }
    if (raw.password) { if (raw.password.length < 6) throw new Error("Geçici şifre en az 6 karakter olmalıdır."); const secured = await hashPassword(raw.password); credentialUpdate.passwordHash = secured.hash; credentialUpdate.passwordSalt = secured.salt; credentialUpdate.mustChangePassword = true; }
    const [member] = await getDb().update(members).set({ ...payload, ...credentialUpdate, updatedAt: new Date().toISOString() }).where(eq(members.id, raw.id)).returning();
    if (!member) return Response.json({ error: "Üye bulunamadı." }, { status: 404 });
    const { passwordHash, passwordSalt, tcHash, ...safeMember } = member;
    return Response.json({ member: { ...safeMember, hasPassword: !!passwordHash } });
  } catch (error) { return Response.json({ error: message(error) }, { status: 400 }); }
}

export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return Response.json({ error: "Üye kimliği eksik." }, { status: 400 });
    const [member] = await getDb().delete(members).where(eq(members.id, id)).returning();
    if (!member) return Response.json({ error: "Üye bulunamadı." }, { status: 404 });
    return Response.json({ success: true });
  } catch (error) { return Response.json({ error: message(error) }, { status: 500 }); }
}
