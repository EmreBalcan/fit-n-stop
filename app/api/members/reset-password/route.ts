import { apiError, requireAdmin } from "../../../../lib/api-auth";
import { adminSupabase, unwrap } from "../../../../lib/supabase";
import { temporaryPassword } from "../../../../lib/member-security";

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const { id } = await request.json() as { id?: number };
    if (!id) throw new Error("Üye kimliği eksik.");
    const db = adminSupabase(), member = unwrap(await db.from("members").select("*").eq("id", id).single());
    if (!member.auth_user_id) throw new Error("Üyenin giriş hesabı bulunamadı.");
    const password = temporaryPassword();
    const { error } = await db.auth.admin.updateUserById(member.auth_user_id, { password });
    if (error) throw error;
    unwrap(await db.from("members").update({ must_change_password: true, updated_at: new Date().toISOString() }).eq("id", id));
    return Response.json({ password });
  } catch (error) { return apiError(error); }
}
