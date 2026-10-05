import { apiError, requireMember } from "../../../../lib/api-auth";
import { adminSupabase, unwrap } from "../../../../lib/supabase";

type CompletedSet = { exerciseId: string; setNumber: number; reps: number; weightKg: number };
const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function validSet(value: unknown): value is CompletedSet {
  if (!value || typeof value !== "object") return false;
  const set = value as Record<string, unknown>;
  return typeof set.exerciseId === "string" && /^[a-z0-9-]{2,80}$/.test(set.exerciseId)
    && typeof set.setNumber === "number" && Number.isInteger(set.setNumber) && set.setNumber >= 1 && set.setNumber <= 30
    && typeof set.reps === "number" && Number.isInteger(set.reps) && set.reps >= 0 && set.reps <= 500
    && typeof set.weightKg === "number" && Number.isFinite(set.weightKg) && set.weightKg >= 0 && set.weightKg <= 1000;
}

export async function GET(request: Request) {
  try {
    const member = await requireMember(request);
    const date = new URL(request.url).searchParams.get("date");
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Geçerli bir tarih seçin.");
    let query = adminSupabase().from("training_sessions").select("*").eq("member_id", member.id);
    if (date) {
      const start = new Date(`${date}T00:00:00+03:00`);
      if (!Number.isFinite(start.getTime())) throw new Error("Geçerli bir tarih seçin.");
      query = query.gte("finished_at", start.toISOString()).lt("finished_at", new Date(start.getTime() + 86_400_000).toISOString());
    }
    const rows = unwrap(await query.order("finished_at", { ascending: false }).limit(date ? 100 : 200));
    return Response.json({ sessions: rows });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const member = await requireMember(request);
    const body = await request.json() as { clientSessionId?: string; programId?: string | null; programName?: string; startedAt?: string; finishedAt?: string; durationSeconds?: number; sets?: unknown };
    if (!uuid(body.clientSessionId) || !body.programName?.trim() || body.programName.length > 80
      || !body.startedAt || !body.finishedAt || !Number.isFinite(Date.parse(body.startedAt)) || !Number.isFinite(Date.parse(body.finishedAt))
      || typeof body.durationSeconds !== "number" || !Number.isInteger(body.durationSeconds) || body.durationSeconds < 0 || body.durationSeconds > 86400
      || !Array.isArray(body.sets) || body.sets.length === 0 || body.sets.length > 500 || !body.sets.every(validSet)) throw new Error("Antrenman kaydı geçersiz.");
    const db = adminSupabase();
    const existing = unwrap(await db.from("training_sessions").select("*").eq("client_session_id", body.clientSessionId).eq("member_id", member.id).maybeSingle());
    if (existing) return Response.json({ session: existing, alreadySaved: true });
    if (body.programId) {
      if (!uuid(body.programId)) throw new Error("Program kimliği geçersiz.");
      const program = unwrap(await db.from("training_programs").select("id").eq("id", body.programId).eq("member_id", member.id).maybeSingle());
      if (!program) throw new Error("Program bulunamadı.");
    }
    const insert = { member_id: member.id, client_session_id: body.clientSessionId, program_id: body.programId || null,
      program_name: body.programName.trim(), started_at: body.startedAt, finished_at: body.finishedAt,
      duration_seconds: body.durationSeconds, sets: body.sets };
    const result = await db.from("training_sessions").insert(insert).select("*").single();
    if (result.error?.message.includes("training_sessions_client_session_id_key")) {
      const duplicate = unwrap(await db.from("training_sessions").select("*").eq("client_session_id", body.clientSessionId).eq("member_id", member.id).single());
      return Response.json({ session: duplicate, alreadySaved: true });
    }
    return Response.json({ session: unwrap(result), alreadySaved: false });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    const member = await requireMember(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!uuid(id)) throw new Error("Antrenman kaydı geçersiz.");
    unwrap(await adminSupabase().from("training_sessions").delete().eq("client_session_id", id).eq("member_id", member.id));
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}
