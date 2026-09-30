import { publicSupabase } from "../../../lib/supabase";
export async function POST(request: Request) {
  try {
    const { refreshToken } = await request.json() as { refreshToken?: string };
    if (!refreshToken) return Response.json({ error: "Oturum yenilenemedi." }, { status: 401 });
    const { data, error } = await publicSupabase().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) return Response.json({ error: "Oturum süresi doldu. Tekrar giriş yapın." }, { status: 401 });
    return Response.json({ accessToken: data.session.access_token, refreshToken: data.session.refresh_token });
  } catch { return Response.json({ error: "Oturum yenilenemedi." }, { status: 401 }); }
}
