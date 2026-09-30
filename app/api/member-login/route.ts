import { apiError } from "../../../lib/api-auth";
import { authEmail, publicSupabase, adminSupabase, rowToMember, unwrap } from "../../../lib/supabase";

export async function POST(request: Request) {
  try {
    const { tcNo, password } = await request.json() as { tcNo?: string; password?: string };
    if (!/^\d{11}$/.test(tcNo || "") || !password) throw new Error("TC kimlik numarası veya şifre hatalı.");
    const { data, error } = await publicSupabase().auth.signInWithPassword({ email: authEmail(tcNo!), password });
    if (error || !data.session) throw new Error("TC kimlik numarası veya şifre hatalı.");
    const row = unwrap(await adminSupabase().from("members").select("*").eq("auth_user_id", data.user.id).single());
    if (row.status === "cancelled") throw new Error("Üyeliğiniz aktif değil. Salon yönetimiyle görüşün.");
    return Response.json({ member: rowToMember(row), accessToken: data.session.access_token, refreshToken: data.session.refresh_token });
  } catch (error) { return apiError(error, 401); }
}
