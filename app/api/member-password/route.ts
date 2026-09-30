import { apiError, requireMember } from "../../../lib/api-auth";
import { adminSupabase, unwrap } from "../../../lib/supabase";

export async function POST(request: Request) {
  try {
    const { newPassword } = await request.json() as { newPassword?: string };
    if (!newPassword || newPassword.length < 6) throw new Error("Yeni şifre en az 6 karakter olmalıdır.");
    const member = await requireMember(request);
    const db = adminSupabase();
    const { error } = await db.auth.admin.updateUserById(member.auth_user_id, { password: newPassword });
    if (error) throw error;
    unwrap(await db.from("members").update({ must_change_password: false, updated_at: new Date().toISOString() }).eq("id", member.id));
    return Response.json({ success: true });
  } catch (error) { return apiError(error); }
}
