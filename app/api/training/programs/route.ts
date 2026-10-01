import { apiError, requireMember } from "../../../../lib/api-auth";
import { adminSupabase, unwrap } from "../../../../lib/supabase";

type ProgramItem = { exerciseId: string; position: number; targetSets: number; targetReps: number; weightKg: number; restSeconds: number };
const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const numberIn = (value: unknown, min: number, max: number) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
function validItem(value: unknown): value is ProgramItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.exerciseId === "string" && /^[a-z0-9-]{2,80}$/.test(item.exerciseId)
    && numberIn(item.position, 0, 100) && numberIn(item.targetSets, 1, 20)
    && numberIn(item.targetReps, 1, 200) && numberIn(item.weightKg, 0, 1000)
    && numberIn(item.restSeconds, 0, 900);
}

export async function GET(request: Request) {
  try {
    const member = await requireMember(request);
    const rows = unwrap(await adminSupabase().from("training_programs").select("*").eq("member_id", member.id).order("updated_at", { ascending: false }));
    return Response.json({ programs: rows });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const member = await requireMember(request);
    const body = await request.json() as { id?: string; name?: string; items?: unknown };
    const name = body.name?.trim();
    if (!name || name.length > 80 || !Array.isArray(body.items) || body.items.length > 80 || !body.items.every(validItem)) throw new Error("Program bilgileri geçersiz.");
    const ids = body.items.map((item: ProgramItem) => item.exerciseId);
    if (new Set(ids).size !== ids.length) throw new Error("Bir hareket programa yalnızca bir kez eklenebilir.");
    const db = adminSupabase();
    const values = { name, items: body.items, updated_at: new Date().toISOString() };
    let row;
    if (body.id) {
      if (!uuid(body.id)) throw new Error("Program kimliği geçersiz.");
      const existing = unwrap(await db.from("training_programs").select("id").eq("id", body.id).eq("member_id", member.id).maybeSingle());
      row = existing
        ? unwrap(await db.from("training_programs").update(values).eq("id", body.id).eq("member_id", member.id).select("*").single())
        : unwrap(await db.from("training_programs").insert({ ...values, id: body.id, member_id: member.id }).select("*").single());
    } else {
      row = unwrap(await db.from("training_programs").insert({ ...values, member_id: member.id }).select("*").single());
    }
    return Response.json({ program: row });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    const member = await requireMember(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!uuid(id)) throw new Error("Program kimliği geçersiz.");
    unwrap(await adminSupabase().from("training_programs").delete().eq("id", id).eq("member_id", member.id));
    return Response.json({ success: true });
  } catch (error) { return apiError(error); }
}
